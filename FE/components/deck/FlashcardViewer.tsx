"use client";

import { useEffect, useMemo, useState } from "react";
import { buildFlashcards } from "@/lib/flashcards";
import { CardPreviewRow, Lines } from "./CardPreview";
import type { ApkgParseResponse } from "@/types/api";

const INITIAL_VISIBLE = 20;
const SHOW_MORE_STEP = 50;

// The study screen shown right after import: page through the deck's cards and
// flip front/back, with a full preview list below. Save lives here too (wired in
// the save chunk via the optional onSave prop).
export function FlashcardViewer({
  parsed,
  onBack,
  onStartTest,
  onSave,
}: {
  parsed: ApkgParseResponse;
  onBack: () => void;
  onStartTest: () => void;
  onSave?: () => void;
}) {
  const cards = useMemo(() => buildFlashcards(parsed.noteTypes), [parsed]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [visible, setVisible] = useState(INITIAL_VISIBLE);
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
          Import another
        </button>
      </div>
    );
  }

  const card = cards[index];

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
      </div>

      {/* Fixed height so front and back are the same size; long content scrolls. */}
      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        className="flex h-[28rem] w-full flex-col rounded-xl border border-neutral-200 p-6 text-center transition hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
      >
        <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-neutral-400">
          {flipped ? "Back" : "Front"}
        </span>
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

      <div className="flex gap-3 border-t border-neutral-200 pt-5 dark:border-neutral-800">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          Import another
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
        <button
          type="button"
          onClick={onStartTest}
          className="ml-auto rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
        >
          Set up a quiz →
        </button>
      </div>

      {/* Full preview list (Quizlet-style), rendered incrementally for big decks. */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">
          Cards in this deck ({cards.length})
        </h2>
        <ul className="space-y-2">
          {cards.slice(0, visible).map((c, i) => (
            <CardPreviewRow key={`${c.id}-${i}`} front={c.front} back={c.back} />
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
    </div>
  );
}
