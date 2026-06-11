"use client";

import { Suspense, useEffect, useMemo, useState, type PointerEvent, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Reorder, useDragControls } from "motion/react";
import { useDeckContents, useReplaceDeckContents } from "@/hooks/useDecks";
import {
  addBasicRow,
  canSwapRow,
  fieldLabel,
  fromContents,
  rowMatches,
  swapAllValues,
  swapValuesForRow,
  toPayload,
  type EditorRow,
  type EditorState,
} from "@/lib/deckEditor";
import { ImportCardsModal, type ImportMode } from "@/components/deck/ImportCardsModal";

export default function DeckEditPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading editor…</p>}>
      <DeckEditor />
    </Suspense>
  );
}

function DeckEditor() {
  const { deckId } = useParams<{ deckId: string }>();
  const router = useRouter();
  const contentsQuery = useDeckContents(deckId);
  const save = useReplaceDeckContents(deckId);

  const [draft, setDraft] = useState<EditorState | null>(null);
  const [dirty, setDirty] = useState(false);
  const [search, setSearch] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [otherTab, setOtherTab] = useState(false);

  // Build the working draft once the deck loads. (State sync from a query, not a
  // data fetch — the rule against useEffect fetching doesn't apply here.)
  useEffect(() => {
    if (contentsQuery.data && !draft) {
      setDraft(fromContents(contentsQuery.data));
    }
  }, [contentsQuery.data, draft]);

  // Soft multi-tab heads-up (last-write-wins, so this only warns). Tabs announce
  // themselves on a per-deck channel; any reply means another editor is open.
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(`deck-editor:${deckId}`);
    channel.onmessage = (e: MessageEvent) => {
      if (e.data === "ping") {
        setOtherTab(true);
        channel.postMessage("pong");
      } else if (e.data === "pong") {
        setOtherTab(true);
      }
    };
    channel.postMessage("ping");
    return () => channel.close();
  }, [deckId]);

  function patch(updater: (d: EditorState) => EditorState) {
    setDraft((d) => (d ? updater(d) : d));
    setDirty(true);
  }
  const setName = (name: string) => patch((d) => ({ ...d, name }));
  const setField = (key: string, field: string, value: string) =>
    patch((d) => ({
      ...d,
      rows: d.rows.map((r) =>
        r.key === key ? { ...r, fields: { ...r.fields, [field]: value } } : r,
      ),
    }));
  const deleteRow = (key: string) =>
    patch((d) => ({ ...d, rows: d.rows.filter((r) => r.key !== key) }));
  const swapRow = (key: string) =>
    patch((d) => ({ ...d, rows: d.rows.map((r) => (r.key === key ? swapValuesForRow(r) : r)) }));
  const swapAll = () => patch((d) => swapAllValues(d));
  const addRow = () => patch((d) => ({ ...d, rows: [...d.rows, addBasicRow()] }));
  const handleImport = (rows: EditorRow[], mode: ImportMode) =>
    patch((d) => ({ ...d, rows: mode === "replace" ? rows : [...d.rows, ...rows] }));

  // Live reorder from the drag list: motion hands back the new key order, so we
  // reshuffle the draft rows to match (row objects, with their edits, are kept).
  const handleReorder = (keys: string[]) =>
    patch((d) => {
      const byKey = new Map(d.rows.map((r) => [r.key, r]));
      return { ...d, rows: keys.map((k) => byKey.get(k)).filter((r): r is EditorRow => !!r) };
    });

  function handleSave() {
    if (!draft) return;
    save.mutate(toPayload(draft), { onSuccess: () => router.push(`/decks/${deckId}`) });
  }
  function handleCancel() {
    if (!dirty || window.confirm("Discard your changes?")) {
      router.push(`/decks/${deckId}`);
    }
  }

  const query = search.trim().toLowerCase();
  // Filter to cards whose content contains the keyword (HTML stripped, so it
  // matches the text the user actually sees). null = no active search.
  const visibleKeys = useMemo(() => {
    if (!draft || !query) return null;
    return new Set(draft.rows.filter((r) => rowMatches(r, query)).map((r) => r.key));
  }, [draft, query]);

  if (contentsQuery.isLoading || !draft) {
    return <p className="text-sm text-muted">Loading editor…</p>;
  }
  if (contentsQuery.isError || !contentsQuery.data) {
    return (
      <div className="mx-auto max-w-3xl space-y-3">
        <p className="text-sm text-muted">Deck not found.</p>
        <Link href="/dashboard" className="text-sm font-medium text-accent hover:underline">
          Back to decks
        </Link>
      </div>
    );
  }

  const rows = draft.rows;
  const reorderable = !query; // disable drag while filtering — order would be partial
  const rowKeys = rows.map((r) => r.key);
  const saveDisabled = save.isPending || draft.name.trim().length === 0;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleCancel}
          className="rounded-input border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium transition hover:border-accent hover:text-accent"
        >
          ← Cancel
        </button>
        <h1 className="font-display text-lg font-semibold tracking-tight">Edit flashcards</h1>
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
            onClick={() => setImportOpen(true)}
            className="rounded-input border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium transition hover:border-accent hover:text-accent"
          >
            Import cards
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saveDisabled}
            className="focus-ring rounded-input bg-accent px-4 py-1.5 text-sm font-semibold text-white shadow-btn transition hover:opacity-95 disabled:opacity-50"
          >
            {save.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {otherTab && (
        <p className="rounded-input border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          This deck is open in another tab. Whichever tab you save last wins.
        </p>
      )}
      {save.isError && (
        <p className="rounded-input border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          Couldn&apos;t save the deck. Please try again.
        </p>
      )}

      <label className="block space-y-1">
        <span className="text-sm font-medium">Deck name</span>
        <input
          type="text"
          value={draft.name}
          onChange={(e) => setName(e.target.value)}
          className="focus-ring w-full rounded-input border border-line-strong bg-surface-2 px-3 py-2 text-sm text-ink outline-none"
        />
      </label>

      <div className="flex items-center justify-between gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search cards…"
          className="focus-ring w-full max-w-xs rounded-input border border-line-strong bg-surface-2 px-3 py-1.5 text-sm text-ink outline-none placeholder:text-faint"
        />
        <span className="shrink-0 font-mono text-xs text-muted">
          {visibleKeys ? `${visibleKeys.size} of ${rows.length}` : rows.length} cards
        </span>
      </div>

      {visibleKeys?.size === 0 && (
        <p className="rounded-card border border-dashed border-line-strong px-4 py-6 text-center text-sm text-muted">
          No cards match “{search.trim()}”.
        </p>
      )}

      {reorderable && rows.length > 1 && (
        <p className="text-xs text-faint">Drag a card to reorder it.</p>
      )}

      {/* While searching, indices are partial — show a plain, non-draggable list.
          Otherwise the cards are a motion Reorder list: grab a card and the rest
          animate out of the way. */}
      {reorderable ? (
        <Reorder.Group
          axis="y"
          values={rowKeys}
          onReorder={handleReorder}
          className="space-y-3"
        >
          {rows.map((row, index) => (
            <DraggableCard
              key={row.key}
              row={row}
              index={index}
              onField={setField}
              onSwap={swapRow}
              onDelete={deleteRow}
            />
          ))}
        </Reorder.Group>
      ) : (
        <ul className="space-y-3">
          {rows.map((row, index) =>
            visibleKeys && !visibleKeys.has(row.key) ? null : (
              <li
                key={row.key}
                className="space-y-2 rounded-card border border-line bg-surface p-4"
              >
                <CardBody
                  row={row}
                  index={index}
                  onField={setField}
                  onSwap={swapRow}
                  onDelete={deleteRow}
                />
              </li>
            ),
          )}
        </ul>
      )}

      <button
        type="button"
        onClick={addRow}
        className="w-full rounded-card border border-dashed border-line-strong px-4 py-3 text-sm text-muted transition hover:border-accent hover:bg-accent-soft/40 hover:text-accent"
      >
        + Add a card
      </button>

      {importOpen && (
        <ImportCardsModal onClose={() => setImportOpen(false)} onImport={handleImport} />
      )}
    </div>
  );
}

interface CardProps {
  row: EditorRow;
  index: number;
  onField: (key: string, field: string, value: string) => void;
  onSwap: (key: string) => void;
  onDelete: (key: string) => void;
}

// A draggable card. The whole card is the drag surface — press anywhere except
// the editable fields / buttons and drag; motion animates the other cards out of
// the way and springs everything into place when you let go. `dragListener` is
// off so a press that lands on a textarea/button edits or clicks instead of
// starting a drag.
function DraggableCard({ row, index, onField, onSwap, onDelete }: CardProps) {
  const controls = useDragControls();
  function startDrag(e: PointerEvent<HTMLLIElement>) {
    if ((e.target as HTMLElement).closest("textarea, input, button, select, a")) return;
    // Stop the browser from starting a text selection that would highlight page
    // content while you drag (we're not on an editable target here, so killing
    // the default is safe).
    e.preventDefault();
    controls.start(e);
  }
  return (
    <Reorder.Item
      value={row.key}
      dragListener={false}
      dragControls={controls}
      onPointerDown={startDrag}
      whileDrag={{ scale: 1.02, boxShadow: "0 12px 28px rgba(0,0,0,0.18)" }}
      className="cursor-grab space-y-2 select-none rounded-card border border-line bg-surface p-4 active:cursor-grabbing"
    >
      <CardBody row={row} index={index} onField={onField} onSwap={onSwap} onDelete={onDelete} />
    </Reorder.Item>
  );
}

// The card's contents — shared by the draggable list and the (static) search
// results list.
function CardBody({ row, index, onField, onSwap, onDelete }: CardProps) {
  return (
    <>
      <div className="flex items-center gap-2 font-mono text-xs text-faint">
        <span>#{index + 1}</span>
        <div className="ml-auto flex items-center gap-1">
          {canSwapRow(row) && (
            <IconBtn label="Swap front/back" onClick={() => onSwap(row.key)}>⇅</IconBtn>
          )}
          <IconBtn label="Delete card" danger onClick={() => onDelete(row.key)}>✕</IconBtn>
        </div>
      </div>
      <div className="space-y-2">
        {row.fieldNames.map((field) => (
          <label key={field} className="block space-y-1">
            <span className="font-mono text-xs font-medium text-muted">{fieldLabel(field)}</span>
            <textarea
              value={row.fields[field] ?? ""}
              onChange={(e) => onField(row.key, field, e.target.value)}
              rows={row.cloze ? 3 : 2}
              className="nice-scroll focus-ring w-full cursor-text select-text resize-y rounded-input border border-line-strong bg-surface-2 px-3 py-1.5 text-sm text-ink outline-none"
            />
          </label>
        ))}
      </div>
    </>
  );
}

function IconBtn({
  children,
  label,
  onClick,
  disabled = false,
  danger = false,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`cursor-pointer rounded px-1.5 py-0.5 text-sm transition hover:bg-surface-2 disabled:cursor-default disabled:opacity-30 ${
        danger ? "text-danger" : "text-muted"
      }`}
    >
      {children}
    </button>
  );
}
