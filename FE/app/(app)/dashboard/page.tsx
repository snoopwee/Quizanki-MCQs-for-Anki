"use client";

import Link from "next/link";
import { useDecks, useDeleteDeck } from "@/hooks/useDecks";

export default function DashboardPage() {
  const decksQuery = useDecks();
  const deleteDeck = useDeleteDeck();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
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
          {decksQuery.data.map((deck) => (
            <li
              key={deck.id}
              className="flex items-center justify-between rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{deck.name}</p>
                <p className="text-sm text-neutral-500">{deck.cardCount ?? 0} cards</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href={`/decks/${deck.id}/quiz`}
                  className="rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
                >
                  Start quiz
                </Link>
                <button
                  type="button"
                  onClick={() => deleteDeck.mutate(deck.id)}
                  disabled={deleteDeck.isPending}
                  className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
