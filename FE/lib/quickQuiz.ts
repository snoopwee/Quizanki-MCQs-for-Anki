// Which deck Home's "Start a quick quiz" tile should open.
//
// It used to be `decks[0]` — whichever deck the API happened to list first. With one deck that is
// invisible; with twenty it is a lottery, and the tile never said which deck it meant, so the only
// way to find out was to press it and read the next screen.

import type { DeckResponse } from "@/types/api";

/**
 * The deck to quiz, or `null` when there is nothing to quiz yet.
 *
 * <p>Prefers the most recently opened deck: "quick" means *resume*, and the thing you touched last
 * is the best guess at what you meant. Falls back to your own decks, because Recent can be empty
 * on a fresh account while the library is not.
 *
 * <p>A deck with no cards is skipped in both lists — a quiz needs something to ask, and offering
 * one that immediately dead-ends is worse than offering nothing. `cardCount` is nullable in the
 * API, and null means "not counted", not "empty", so it is treated as usable.
 */
export function quickQuizDeck(
  recent: DeckResponse[] | undefined,
  own: DeckResponse[] | undefined,
): DeckResponse | null {
  const usable = (d: DeckResponse) => d.cardCount === null || d.cardCount > 0;
  return (recent ?? []).find(usable) ?? (own ?? []).find(usable) ?? null;
}

/**
 * What the tile says it will do, naming the deck so the click holds no surprise.
 *
 * <p>The old copy — "Jump straight into an MCQ test built from one of your decks" — described the
 * feature rather than the action, and "one of your decks" is precisely the part the user wanted to
 * know.
 */
export function quickQuizDescription(deck: DeckResponse | null): string {
  if (!deck) return "Import a deck first, then jump straight into a multiple-choice test.";
  return `Multiple-choice test from ${deck.name}.`;
}
