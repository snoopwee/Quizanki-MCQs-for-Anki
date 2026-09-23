"use client";

import Link from "next/link";
import { DeckAuthor } from "@/components/deck/DeckAuthor";
import { Card } from "@/components/ui/Card";
import { Ring } from "@/components/ui/Ring";
import { Icon } from "@/components/ui/icons";
import { StarRating } from "@/components/ui/StarRating";
import type { DeckResponse } from "@/types/api";

// The deck card grid used by Home's tabs and by a folder's contents — extracted so a folder
// renders decks exactly as Home does, rather than growing a second deck card.
export function DeckGrid({
  query,
  showAuthor = false,
  emptyTitle,
  emptyHint,
  emptyAction,
}: {
  query: { data?: DeckResponse[]; isLoading: boolean; isError: boolean };
  showAuthor?: boolean;
  emptyTitle: string;
  emptyHint?: string;
  emptyAction?: React.ReactNode;
}) {
  const decks = query.data ?? [];

  if (query.isLoading) return <p className="text-sm text-muted">Loading…</p>;
  if (query.isError) return <p className="text-sm text-danger">Could not load decks.</p>;

  if (decks.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-3 border-dashed px-6 py-14 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-input bg-accent-soft text-accent">
          <Icon name="cards" size={24} />
        </span>
        <p className="text-sm font-medium text-ink">{emptyTitle}</p>
        {emptyHint && <p className="max-w-xs text-sm text-muted">{emptyHint}</p>}
        {emptyAction}
      </Card>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {decks.map((deck) => (
        <li key={deck.id}>
          {/* Stretched-link card so the author link inside isn't nested in the
              card link (nested <a> is invalid HTML). */}
          <Card hover className="relative overflow-hidden p-0">
            <div className="h-1.5 bg-accent" />
            <div className="p-5">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p
                    title={deck.name}
                    className="truncate font-display text-base font-semibold text-ink"
                  >
                    {deck.name}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-faint">
                    <span className="inline-flex items-center gap-1.5">
                      <Icon name="layers" size={13} />
                      {deck.cardCount ?? 0} cards
                    </span>
                    {/* The score sits where "Shared" used to: whether a deck is public is a
                        property of YOUR copy and says nothing about whether it is any good.
                        Always shown, zero included — "0.0 stars (0)" is a fact about the deck. */}
                    <StarRating average={deck.ratingAverage} count={deck.ratingCount} size={13} />
                  </p>
                  {showAuthor && (
                    <DeckAuthor
                      // DeckResponse carries no handle, so these link by id and redirect.
                      // Only the public listings (Discover, a profile page) carry one.
                      authorId={deck.authorId}
                      authorName={deck.authorName}
                      authorAvatarUrl={deck.authorAvatarUrl}
                      sourceAuthorName={deck.sourceAuthorName}
                      className="relative z-20 mt-1.5"
                    />
                  )}
                </div>
                <Ring value={Math.round(deck.completion ?? 0) / 100} size={46} label={`${Math.round(deck.completion ?? 0)}%`} />
              </div>
            </div>
            <Link
              href={`/decks/${deck.id}`}
              aria-label={deck.name}
              className="absolute inset-0 z-10"
            />
          </Card>
        </li>
      ))}
    </ul>
  );
}
