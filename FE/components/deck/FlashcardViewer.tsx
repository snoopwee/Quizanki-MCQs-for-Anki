"use client";

import { useEffect, useMemo, useState } from "react";
import { buildFlashcards } from "@/lib/flashcards";
import { classifyMastery } from "@/lib/masteryStage";
import { CardPreviewRow, Lines, StageBadge } from "./CardPreview";
import { KebabMenu } from "@/components/shared/KebabMenu";
import { StarButton } from "@/components/shared/StarButton";
import { EditFlashcardModal, type EditableNote } from "./EditFlashcardModal";
import type { ApkgParseResponse } from "@/types/api";

// Same shape ApkgQuizSetup uses — callers can pass a single lookup that serves
// both screens.
type StatsLookup = (noteId: string) =>
  | { mastery?: number; timesSeen?: number }
  | undefined;

const INITIAL_VISIBLE = 20;
const SHOW_MORE_STEP = 50;

// The study screen shown right after import: page through the deck's cards and
// flip front/back, with a full preview list below. Save lives here too (wired in
// the save chunk via the optional onSave prop).
export function FlashcardViewer({
  parsed,
  completion,
  getStats,
  onBack,
  onStartTest,
  onSave,
  backLabel = "Import another",
  hideActions = false,
  editable = false,
  deckId,
  getStarred,
  onToggleStar,
}: {
  parsed: ApkgParseResponse;
  // Mean mastery across the deck (0-100). Surfaced as a percent + progress bar
  // when present; hidden for the trial flow where no server-side completion exists.
  completion?: number;
  // Per-card mastery lookup. When provided, each card surfaces a colour-coded
  // stage badge (New / Learning / Practicing / Mastered) so the learner can
  // scan progress at a glance.
  getStats?: StatsLookup;
  onBack: () => void;
  // Optional: when absent, the bottom row drops the "Set up a quiz" button.
  // Used by the auth /import flow, which keeps quiz launches on the dashboard.
  onStartTest?: () => void;
  onSave?: () => void;
  backLabel?: string;
  // When true, suppress the bottom Back/Save/Start-quiz row — the surrounding
  // page chrome (breadcrumb + action bar) handles those actions instead.
  hideActions?: boolean;
  // When true (and deckId is set), each card gets a "⋯" menu to edit its fields.
  // Only enabled for saved decks; the guest/import flow leaves it off.
  editable?: boolean;
  deckId?: string;
  // Star (focus) support. When both are provided, a ★ toggle appears on the
  // current card and every preview row. Keyed by the flashcard id (the note id),
  // so all clozes of one note share a star.
  getStarred?: (id: string) => boolean;
  onToggleStar?: (id: string, next: boolean) => void;
}) {
  const cards = useMemo(() => buildFlashcards(parsed.noteTypes), [parsed]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [visible, setVisible] = useState(INITIAL_VISIBLE);
  const [showTop, setShowTop] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Card front/back are flattened strings, so editing needs the original note:
  // its full field map, the type's field order, and the cloze flag. Keyed by the
  // persisted note UUID, which is also the flashcard id for saved decks. Cloze
  // notes map many cards to one id — editing any of them edits the shared note.
  const noteIndex = useMemo(() => {
    const map = new Map<string, EditableNote>();
    for (const nt of parsed.noteTypes) {
      for (const note of nt.notes) {
        if (!note.id) continue; // only persisted notes can be edited
        map.set(note.id, {
          noteId: note.id,
          noteType: nt.name,
          cloze: nt.cloze,
          fieldNames: nt.fieldNames,
          frontFields: nt.frontFields,
          backFields: nt.backFields,
          fields: note.fields,
        });
      }
    }
    return map;
  }, [parsed]);

  const canEdit = editable && Boolean(deckId);
  const editingNote = editingId ? noteIndex.get(editingId) : null;

  const canStar = Boolean(getStarred && onToggleStar);
  function starFor(id: string, size: "sm" | "md") {
    if (!canStar) return null;
    return (
      <StarButton
        starred={getStarred!(id)}
        size={size}
        onToggle={(next) => onToggleStar!(id, next)}
      />
    );
  }

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Keyboard nav: ←/A previous card, →/D next card. Skipped when focus is in a
  // form control (so other inputs on the page keep their native behavior) and
  // when a modal is open (Delete-confirm sets aria-modal, so this won't fight
  // it). No-ops on an empty deck — the lastIndex math just clamps to 0.
  useEffect(() => {
    const lastIndex = cards.length - 1;
    function onKey(e: KeyboardEvent) {
      if (e.repeat || e.defaultPrevented) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        if (target.isContentEditable) return;
      }
      if (document.querySelector('[aria-modal="true"]')) return;

      const isPrev = e.key === "ArrowLeft" || e.key === "a" || e.key === "A";
      const isNext = e.key === "ArrowRight" || e.key === "d" || e.key === "D";
      const isFlip = e.key === " ";
      if (isPrev) {
        e.preventDefault();
        setFlipped(false);
        setIndex((i) => Math.max(0, i - 1));
      } else if (isNext) {
        e.preventDefault();
        setFlipped(false);
        setIndex((i) => Math.min(lastIndex, i + 1));
      } else if (isFlip) {
        // Preempt the browser default (page scroll) so Space stays a flip key.
        e.preventDefault();
        setFlipped((f) => !f);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [cards.length]);

  if (cards.length === 0) {
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-semibold">{parsed.filename}</h1>
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          We couldn&apos;t build any flashcards from this deck — its note types don&apos;t have
          readable text fields.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          {backLabel}
        </button>
      </div>
    );
  }

  const card = cards[index];
  const cardStage = getStats ? classifyMastery(getStats(card.id)) : null;

  function go(delta: number) {
    setFlipped(false);
    setIndex((i) => Math.min(cards.length - 1, Math.max(0, i + delta)));
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">{parsed.filename}</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {cards.length} cards — study them, then set up a quiz.
        </p>
        {completion !== undefined && (
          <div className="mt-3 max-w-xs">
            <div className="flex items-center justify-between text-xs text-neutral-500">
              <span>Deck completion</span>
              <span className="font-medium text-neutral-700 dark:text-neutral-300">
                {Math.round(completion)}%
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
              <div
                className="h-full bg-neutral-900 transition-[width] dark:bg-neutral-100"
                style={{ width: `${Math.round(completion)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {(canStar || (canEdit && noteIndex.has(card.id))) && (
        <div className="flex items-center justify-between gap-2 text-xs text-neutral-500">
          {canStar ? (
            <div className="flex items-center gap-1.5">
              {starFor(card.id, "md")}
              <span>{getStarred!(card.id) ? "Starred" : "Star this card"}</span>
            </div>
          ) : (
            <span />
          )}
          {canEdit && noteIndex.has(card.id) ? (
            <div className="flex items-center gap-1">
              <span>Edit this card</span>
              <KebabMenu
                label="Edit this card"
                items={[{ label: "Edit fields", onClick: () => setEditingId(card.id) }]}
              />
            </div>
          ) : (
            <span />
          )}
        </div>
      )}

      {/* Fixed height so front and back are the same size; long content scrolls. */}
      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        className="flex h-[28rem] w-full flex-col rounded-xl border border-neutral-200 p-6 text-center transition hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
      >
        <div className="flex shrink-0 items-center justify-between gap-3">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">
            {flipped ? "Back" : "Front"}
          </span>
          {cardStage && <StageBadge info={cardStage} />}
        </div>
        <div className="nice-scroll flex flex-1 flex-col items-center overflow-y-auto py-3">
          {/* my-auto centers content when it fits, but collapses so the top stays
              scrollable when content overflows (justify-center would clip it). */}
          <div className="my-auto w-full space-y-2">
            <Lines values={flipped ? card.back : card.front} className="text-4xl font-medium" />
          </div>
        </div>
        <span className="shrink-0 text-xs text-neutral-400">Click to flip</span>
      </button>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={index === 0}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100 disabled:opacity-40 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          ← Prev
        </button>
        <span className="text-sm text-neutral-500">
          {index + 1} / {cards.length}
          {parsed.noteTypes.length > 1 && (
            <span className="ml-2 text-neutral-400">· {card.noteType}</span>
          )}
        </span>
        <button
          type="button"
          onClick={() => go(1)}
          disabled={index === cards.length - 1}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100 disabled:opacity-40 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          Next →
        </button>
      </div>
      <p className="text-center text-[11px] text-neutral-400">
        Keys: <kbd className="rounded border border-neutral-300 px-1 dark:border-neutral-700">←</kbd>
        /<kbd className="rounded border border-neutral-300 px-1 dark:border-neutral-700">A</kbd> prev
        · <kbd className="rounded border border-neutral-300 px-1 dark:border-neutral-700">→</kbd>
        /<kbd className="rounded border border-neutral-300 px-1 dark:border-neutral-700">D</kbd> next
        · <kbd className="rounded border border-neutral-300 px-1 dark:border-neutral-700">Space</kbd> flip
      </p>

      {!hideActions && (
        <div className="flex gap-3 border-t border-neutral-200 pt-5 dark:border-neutral-800">
          <button
            type="button"
            onClick={onBack}
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            {backLabel}
          </button>
          {onSave && (
            <button
              type="button"
              onClick={onSave}
              className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
            >
              Save deck
            </button>
          )}
          {onStartTest && (
            <button
              type="button"
              onClick={onStartTest}
              className="ml-auto rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
            >
              Set up a quiz →
            </button>
          )}
        </div>
      )}

      {/* Full preview list (Quizlet-style), rendered incrementally for big decks. */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">
          Cards in this deck ({cards.length})
        </h2>
        <ul className="space-y-2">
          {cards.slice(0, visible).map((c, i) => (
            <CardPreviewRow
              key={`${c.id}-${i}`}
              front={c.front}
              back={c.back}
              stats={getStats?.(c.id)}
              action={
                canStar || (canEdit && noteIndex.has(c.id)) ? (
                  <div className="flex items-center gap-1">
                    {starFor(c.id, "sm")}
                    {canEdit && noteIndex.has(c.id) && (
                      <KebabMenu
                        items={[{ label: "Edit fields", onClick: () => setEditingId(c.id) }]}
                      />
                    )}
                  </div>
                ) : undefined
              }
            />
          ))}
        </ul>

        {visible < cards.length && (
          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={() => setVisible((v) => Math.min(cards.length, v + SHOW_MORE_STEP))}
              className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
            >
              Show more
            </button>
            <button
              type="button"
              onClick={() => setVisible(cards.length)}
              className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
            >
              Show all ({cards.length})
            </button>
          </div>
        )}
      </div>

      {showTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-6 right-6 z-10 rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium shadow-md hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
        >
          ↑ Top
        </button>
      )}

      {canEdit && deckId && editingNote && (
        <EditFlashcardModal
          deckId={deckId}
          note={editingNote}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  );
}
