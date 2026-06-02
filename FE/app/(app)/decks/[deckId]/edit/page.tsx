"use client";

import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useDeckContents, useReplaceDeckContents } from "@/hooks/useDecks";
import {
  addBasicRow,
  canSwapRow,
  fromContents,
  move,
  swapLayoutAll,
  swapValuesForRow,
  toPayload,
  type EditorRow,
  type EditorState,
} from "@/lib/deckEditor";
import { ImportCardsModal, type ImportMode } from "@/components/deck/ImportCardsModal";

export default function DeckEditPage() {
  return (
    <Suspense fallback={<p className="text-sm text-neutral-500">Loading editor…</p>}>
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
  const moveRow = (key: string, delta: number) =>
    patch((d) => {
      const i = d.rows.findIndex((r) => r.key === key);
      return { ...d, rows: move(d.rows, i, i + delta) };
    });
  const swapRow = (key: string) =>
    patch((d) => ({ ...d, rows: d.rows.map((r) => (r.key === key ? swapValuesForRow(r) : r)) }));
  const swapAll = () => patch((d) => swapLayoutAll(d));
  const addRow = () => patch((d) => ({ ...d, rows: [...d.rows, addBasicRow()] }));
  const handleImport = (rows: EditorRow[], mode: ImportMode) =>
    patch((d) => ({ ...d, rows: mode === "replace" ? rows : [...d.rows, ...rows] }));

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
  const visibleKeys = useMemo(() => {
    if (!draft || !query) return null;
    return new Set(
      draft.rows
        .filter((r) => Object.values(r.fields).some((v) => v.toLowerCase().includes(query)))
        .map((r) => r.key),
    );
  }, [draft, query]);

  if (contentsQuery.isLoading || !draft) {
    return <p className="text-sm text-neutral-500">Loading editor…</p>;
  }
  if (contentsQuery.isError || !contentsQuery.data) {
    return (
      <div className="mx-auto max-w-3xl space-y-3">
        <p className="text-sm text-neutral-500">Deck not found.</p>
        <Link href="/dashboard" className="text-sm font-medium underline">
          Back to decks
        </Link>
      </div>
    );
  }

  const rows = draft.rows;
  const reorderable = !query; // hide move arrows while filtering — indices would lie
  const saveDisabled = save.isPending || draft.name.trim().length === 0;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleCancel}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          ← Cancel
        </button>
        <h1 className="text-lg font-semibold">Edit flashcards</h1>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={swapAll}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            ⇅ Swap all front/back
          </button>
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            Import cards
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saveDisabled}
            className="rounded-md bg-black px-4 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
          >
            {save.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {otherTab && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          This deck is open in another tab. Whichever tab you save last wins.
        </p>
      )}
      {save.isError && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          Couldn&apos;t save the deck. Please try again.
        </p>
      )}

      <label className="block space-y-1">
        <span className="text-sm font-medium">Deck name</span>
        <input
          type="text"
          value={draft.name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900"
        />
      </label>

      <div className="flex items-center justify-between gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search cards…"
          className="w-full max-w-xs rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900"
        />
        <span className="shrink-0 text-xs text-neutral-500">{rows.length} cards</span>
      </div>

      <ul className="space-y-3">
        {rows.map((row, index) => {
          if (visibleKeys && !visibleKeys.has(row.key)) return null;
          return (
            <li
              key={row.key}
              className="space-y-2 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
            >
              <div className="flex items-center gap-2 text-xs text-neutral-400">
                <span>#{index + 1}</span>
                {row.cloze && <span className="rounded bg-sky-100 px-1.5 text-sky-700 dark:bg-sky-950 dark:text-sky-300">cloze</span>}
                <div className="ml-auto flex items-center gap-1">
                  {reorderable && (
                    <>
                      <IconBtn label="Move up" disabled={index === 0} onClick={() => moveRow(row.key, -1)}>↑</IconBtn>
                      <IconBtn label="Move down" disabled={index === rows.length - 1} onClick={() => moveRow(row.key, 1)}>↓</IconBtn>
                    </>
                  )}
                  {canSwapRow(row) && (
                    <IconBtn label="Swap front/back" onClick={() => swapRow(row.key)}>⇅</IconBtn>
                  )}
                  <IconBtn label="Delete card" danger onClick={() => deleteRow(row.key)}>✕</IconBtn>
                </div>
              </div>
              <div className="space-y-2">
                {row.fieldNames.map((field) => (
                  <label key={field} className="block space-y-1">
                    <span className="text-xs font-medium text-neutral-500">{field}</span>
                    <textarea
                      value={row.fields[field] ?? ""}
                      onChange={(e) => setField(row.key, field, e.target.value)}
                      rows={row.cloze ? 3 : 2}
                      className="nice-scroll w-full resize-y rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:border-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900"
                    />
                  </label>
                ))}
              </div>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={addRow}
        className="w-full rounded-lg border border-dashed border-neutral-300 px-4 py-3 text-sm text-neutral-600 hover:border-neutral-400 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
      >
        + Add a card
      </button>

      {importOpen && (
        <ImportCardsModal onClose={() => setImportOpen(false)} onImport={handleImport} />
      )}
    </div>
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
      className={`rounded px-1.5 py-0.5 text-sm hover:bg-neutral-100 disabled:opacity-30 dark:hover:bg-neutral-800 ${
        danger ? "text-red-600 dark:text-red-400" : "text-neutral-600 dark:text-neutral-300"
      }`}
    >
      {children}
    </button>
  );
}
