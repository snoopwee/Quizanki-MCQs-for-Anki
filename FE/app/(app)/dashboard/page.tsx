"use client";

import Link from "next/link";
import { useDecks } from "@/hooks/useDecks";

export default function DashboardPage() {
  const decksQuery = useDecks();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Your decks</h1>
        <Link
          href="/import"
          className="rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
        >
          Import deck
        </Link>
      </div>

      {decksQuery.isLoading && <p className="text-sm text-neutral-500">Loading…</p>}

      {decksQuery.isError && (
        <p className="text-sm text-red-600 dark:text-red-400">Could not load decks.</p>
      )}

      {decksQuery.data && decksQuery.data.length === 0 && (
        <div className="rounded-lg border border-dashed border-neutral-300 p-8 text-center dark:border-neutral-700">
          <p className="text-sm text-neutral-500">No decks yet.</p>
          <Link href="/import" className="mt-2 inline-block text-sm font-medium underline">
            Import your first deck
          </Link>
        </div>
      )}

      {decksQuery.data && decksQuery.data.length > 0 && (
        <ul className="space-y-3">
          {decksQuery.data.map((deck) => {
            const completion = Math.round(deck.completion ?? 0);
            return (
              <li key={deck.id}>
                {/* Whole card is the link; delete moves to the deck detail page. */}
                <Link
                  href={`/decks/${deck.id}`}
                  className="block rounded-lg border border-neutral-200 p-4 transition-colors hover:border-neutral-400 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:border-neutral-600 dark:hover:bg-neutral-900/40"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate font-medium">{deck.name}</p>
                    <span className="shrink-0 text-sm text-neutral-500">
                      {completion}% complete
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-neutral-500">{deck.cardCount ?? 0} cards</p>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                    <div
                      className="h-full bg-neutral-900 transition-[width] dark:bg-neutral-100"
                      style={{ width: `${completion}%` }}
                    />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
