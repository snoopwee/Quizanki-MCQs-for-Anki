"use client";

import { useMemo, useState } from "react";
import { parseDeck, type ParseResult } from "@/lib/parseDeck";

const MIN_CARDS = 4;

const EXAMPLE_DECK = [
  "食べる\tto eat",
  "飲む\tto drink",
  "行く\tto go",
  "見る\tto see",
  "話す\tto speak",
  "読む\tto read",
  "書く\tto write",
  "聞く\tto listen",
].join("\n");

export function DeckImporter({ onContinue }: { onContinue: (result: ParseResult) => void }) {
  const [text, setText] = useState("");

  const result = useMemo(() => parseDeck(text), [text]);
  const cardCount = result.notes.length;
  const enough = cardCount >= MIN_CARDS;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Import a deck</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Paste an Anki plain-text export (one note per line, fields separated by tabs).
        </p>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={12}
        spellCheck={false}
        placeholder={"食べる\tto eat\n飲む\tto drink\n…"}
        className="w-full rounded-md border border-neutral-300 bg-transparent p-3 font-mono text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:focus:border-neutral-200"
      />

      <div className="flex items-center justify-between text-sm">
        <span className={enough ? "text-neutral-500" : "text-amber-600 dark:text-amber-400"}>
          {cardCount === 0
            ? "No cards detected yet"
            : `${cardCount} card${cardCount === 1 ? "" : "s"} detected`}
          {cardCount > 0 && !enough && ` — need at least ${MIN_CARDS}`}
        </span>
        <button
          type="button"
          onClick={() => setText(EXAMPLE_DECK)}
          className="rounded-md border border-neutral-300 px-3 py-1.5 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          Load example deck
        </button>
      </div>

      <button
        type="button"
        disabled={!enough}
        onClick={() => onContinue(result)}
        className="w-full rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
      >
        Detect fields
      </button>
    </div>
  );
}
