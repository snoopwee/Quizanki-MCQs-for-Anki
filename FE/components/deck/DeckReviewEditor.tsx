"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { EditableCard } from "@/components/deck/EditableCard";
import { Segmented } from "@/components/ui/controls";
import { Spinner } from "@/components/ui/Spinner";
import { Icon } from "@/components/ui/icons";
import {
  addBasicRow,
  rowMatches,
  swapAllValues,
  swapValuesForRow,
  type EditorRow,
  type EditorState,
} from "@/lib/deckEditor";
import { draftCardCount } from "@/lib/deckDraft";

// How many cards to mount per page. Big enough to review at a glance, small
// enough that entering the editor is instant even for a 5,000-card deck.
const PAGE_SIZE = 60;

/**
 * The review step of an import: look the deck over, fix anything, and choose
 * whether to publish it — before it's saved. Nothing here touches the network;
 * the page owns the draft, the autosave and the save mutation.
 *
 * Kept separate from the saved-deck editor (app/(app)/decks/[deckId]/edit)
 * because that one also deals with note ids, layout swaps and drag reorder,
 * which a not-yet-saved deck has no use for. The per-card body is shared
 * (EditableCard), so editing feels identical in both.
 */
export function DeckReviewEditor({
  draft,
  isPublic,
  saving,
  error,
  onChange,
  onVisibilityChange,
  onSave,
  onDiscard,
}: {
  draft: EditorState;
  isPublic: boolean;
  saving: boolean;
  error: boolean;
  onChange: (next: EditorState) => void;
  onVisibilityChange: (isPublic: boolean) => void;
  onSave: () => void;
  onDiscard: () => void;
}) {
  const [search, setSearch] = useState("");
  // Render cards in pages rather than all at once: a big deck runs to 5,000 cards,
  // and mounting every EditableCard on entry froze the screen for seconds. The
  // reviewer spot-checks (and can Search the full set), so a first page + "Show
  // more" is enough on screen; Save still writes every card in the draft.
  const [limit, setLimit] = useState(PAGE_SIZE);

  const patch = (updater: (d: EditorState) => EditorState) => onChange(updater(draft));

  const setName = (name: string) => patch((d) => ({ ...d, name }));
  const setField = (key: string, field: string, value: string) =>
    patch((d) => ({
      ...d,
      rows: d.rows.map((r) =>
        r.key === key ? { ...r, fields: { ...r.fields, [field]: value } } : r,
      ),
    }));
  const setLang = (key: string, face: "front" | "back", code: string) =>
    patch((d) => ({
      ...d,
      rows: d.rows.map((r) =>
        r.key === key ? { ...r, [face === "front" ? "frontLang" : "backLang"]: code } : r,
      ),
    }));
  const deleteRow = (key: string) =>
    patch((d) => ({ ...d, rows: d.rows.filter((r) => r.key !== key) }));
  const swapRow = (key: string) =>
    patch((d) => ({ ...d, rows: d.rows.map((r) => (r.key === key ? swapValuesForRow(r) : r)) }));
  const swapAll = () => patch((d) => swapAllValues(d));
  const addRow = () => patch((d) => ({ ...d, rows: [...d.rows, addBasicRow()] }));

  const query = search.trim().toLowerCase();
  // Each visible row keeps its position in the FULL deck, so the "#12" label
  // stays honest while filtering. Paired up front rather than looked up per row —
  // an indexOf inside the render loop is quadratic, and a deck runs to 5,000 cards.
  const visible: Array<{ row: EditorRow; index: number }> = useMemo(() => {
    const all = draft.rows.map((row, index) => ({ row, index }));
    return query ? all.filter(({ row }) => rowMatches(row, query)) : all;
  }, [draft.rows, query]);

  // A new search is a fresh view — start it back at the first page.
  useEffect(() => setLimit(PAGE_SIZE), [query]);
  const shown = visible.slice(0, limit);
  const remaining = visible.length - shown.length;

  // "Show all" can mount thousands of cards — do it in a transition so the click
  // isn't a freeze, and show a spinner while the extra rows render.
  const [isExpanding, startExpanding] = useTransition();
  const showMore = () => startExpanding(() => setLimit((n) => n + PAGE_SIZE));
  const showAll = () => startExpanding(() => setLimit(visible.length));

  const cardCount = draftCardCount(draft);
  const saveDisabled = saving || cardCount === 0 || draft.name.trim().length === 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onDiscard}
          className="rounded-input border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium transition hover:border-danger hover:text-danger"
        >
          Discard
        </button>
        <h1 className="font-display text-lg font-semibold tracking-tight">Review before saving</h1>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={swapAll}
            aria-label="Swap term and definition for all cards"
            title="Swap the term and definition of all cards"
            className="rounded-input border border-line-strong bg-surface px-2.5 py-1.5 text-base leading-none transition hover:border-accent hover:text-accent"
          >
            ⇅
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saveDisabled}
            className="focus-ring rounded-input bg-accent px-4 py-1.5 text-sm font-semibold text-white shadow-btn transition hover:opacity-95 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save deck"}
          </button>
        </div>
      </div>

      <p className="rounded-input border border-line bg-surface-2 px-3 py-2 text-xs leading-relaxed text-muted">
        This deck isn&apos;t saved yet — nothing lands in your account until you hit{" "}
        <span className="font-semibold text-ink">Save deck</span>. Your progress here is kept on this
        device, so you can come back to it.
      </p>

      {error && (
        <p className="rounded-input border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          Couldn&apos;t save the deck. Your work is safe — try again.
        </p>
      )}

      <label className="block space-y-1">
        <span className="text-sm font-medium">Deck name</span>
        <input
          type="text"
          value={draft.name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Untitled deck"
          className="focus-ring w-full rounded-input border border-line-strong bg-surface-2 px-3 py-2 text-sm text-ink outline-none placeholder:text-faint"
        />
      </label>

      <VisibilityChoice isPublic={isPublic} onChange={onVisibilityChange} />

      <div className="flex items-center justify-between gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search cards…"
          className="focus-ring w-full max-w-xs rounded-input border border-line-strong bg-surface-2 px-3 py-1.5 text-sm text-ink outline-none placeholder:text-faint"
        />
        <span className="shrink-0 font-mono text-xs text-muted">
          {query ? `${visible.length} of ${cardCount}` : cardCount} cards
        </span>
      </div>

      {query && visible.length === 0 && (
        <p className="rounded-card border border-dashed border-line-strong px-4 py-6 text-center text-sm text-muted">
          No cards match “{search.trim()}”.
        </p>
      )}

      <ul className="space-y-3">
        {shown.map(({ row, index }) => (
          <li key={row.key} className="space-y-2 rounded-card border border-line bg-surface p-4">
            <EditableCard
              row={row}
              index={index}
              onField={setField}
              onSwap={swapRow}
              onDelete={deleteRow}
              onLang={setLang}
            />
          </li>
        ))}
      </ul>

      {remaining > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={showMore}
            disabled={isExpanding}
            className="flex-1 rounded-card border border-line-strong bg-surface px-4 py-2.5 text-sm font-medium text-muted transition hover:border-accent hover:text-accent disabled:opacity-60"
          >
            Show {Math.min(remaining, PAGE_SIZE)} more{" "}
            <span className="text-faint">({remaining} left)</span>
          </button>
          <button
            type="button"
            onClick={showAll}
            disabled={isExpanding}
            title="Render every remaining card — may take a moment on a very large deck"
            className="inline-flex items-center gap-2 rounded-card border border-line-strong bg-surface px-4 py-2.5 text-sm font-medium text-muted transition hover:border-accent hover:text-accent disabled:opacity-60"
          >
            {isExpanding && <Spinner className="h-4 w-4 text-accent" />}
            Show all
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={addRow}
        className="w-full rounded-card border border-dashed border-line-strong px-4 py-3 text-sm text-muted transition hover:border-accent hover:bg-accent-soft/40 hover:text-accent"
      >
        + Add a card
      </button>
    </div>
  );
}

// Public / private, decided at save time. Public is the default, but it's shown
// as a full-width choice with its consequence spelled out rather than a buried
// toggle — plenty of Anki decks are personal or copyrighted, and publishing one
// shouldn't be something the user only discovers afterwards.
function VisibilityChoice({
  isPublic,
  onChange,
}: {
  isPublic: boolean;
  onChange: (isPublic: boolean) => void;
}) {
  return (
    <div className="space-y-2 rounded-card border border-line bg-surface p-4">
      <div className="flex items-center gap-2">
        <Icon name={isPublic ? "link" : "lock"} size={16} className="text-muted" />
        <span className="text-sm font-semibold text-ink">Who can see this deck</span>
      </div>
      <Segmented
        options={[
          { value: "public", label: "Public" },
          { value: "private", label: "Private" },
        ]}
        value={isPublic ? "public" : "private"}
        onChange={(v) => onChange(v === "public")}
      />
      <p className="text-xs leading-relaxed text-muted">
        {isPublic ? (
          <>
            Anyone can find this deck on <span className="font-medium text-ink">Discover</span> and
            save their own copy of it. Your progress stays private. Only publish decks you&apos;re
            free to share.
          </>
        ) : (
          <>
            Only you can see this deck. You can publish it later from the deck&apos;s ⋯ menu.
          </>
        )}
      </p>
    </div>
  );
}
