// Pure logic for the Match study mode — a timed game where the learner pairs each
// term (card front) with its definition (card back). Kept separate from the game
// component so tile building, match checking, and time formatting are unit-tested
// in isolation. Match never touches the backend: it's a speed game, not a review,
// so it records no answers and updates no mastery.

import type { Flashcard } from "@/lib/flashcards";

// One face of a card laid out on the board. `cardId` is a ROUND-LOCAL key (not the
// note id): cloze cards from one note share a note id, so we disambiguate by
// position to keep each pair independent and every tile id unique.
export interface MatchTile {
  tileId: string;
  cardId: string;
  face: "front" | "back";
  text: string;
}

// How many pairs a full round uses (12 tiles). Best times are only tracked for
// full rounds so comparisons stay apples-to-apples.
export const MATCH_PAIRS_PER_ROUND = 6;

function shuffle<T>(items: T[], rng: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// A card is playable only when it has both a term and a definition to pair.
export function matchableCards(cards: Flashcard[]): Flashcard[] {
  return cards.filter(
    (c) => c.front.some((s) => s.trim().length > 0) && c.back.some((s) => s.trim().length > 0),
  );
}

// Builds a shuffled board of `pairCount` pairs (capped by how many cards are
// playable). Returns an empty board when fewer than two pairs are available —
// a one-pair "game" isn't one. Text joins each face's fields for display; the
// component strips LaTeX at render time.
export function buildMatchTiles(
  cards: Flashcard[],
  pairCount: number,
  rng: () => number = Math.random,
): MatchTile[] {
  const usable = matchableCards(cards);
  const n = Math.min(Math.max(0, pairCount), usable.length);
  if (n < 2) return [];
  const picked = shuffle(usable, rng).slice(0, n);
  const tiles: MatchTile[] = [];
  picked.forEach((c, i) => {
    // Round-local key: unique even when two cards share a note id (cloze).
    const key = `${c.id}#${i}`;
    tiles.push({ tileId: `${key}:front`, cardId: key, face: "front", text: c.front.join(" · ") });
    tiles.push({ tileId: `${key}:back`, cardId: key, face: "back", text: c.back.join(" · ") });
  });
  return shuffle(tiles, rng);
}

// Two tiles match when they're opposite faces of the same card.
export function isMatch(a: MatchTile, b: MatchTile): boolean {
  return a.cardId === b.cardId && a.face !== b.face;
}

// Formats an elapsed time: sub-minute as "12.3s", a minute or more as "1:05.3".
export function formatMatchTime(ms: number): string {
  const totalSec = Math.max(0, ms) / 1000;
  if (totalSec < 60) return `${totalSec.toFixed(1)}s`;
  const m = Math.floor(totalSec / 60);
  const s = totalSec - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}

const BEST_PREFIX = "quizanki:match-best:v1:";

// Best (fastest) full-round time for a deck, in ms. localStorage-only — a personal
// record, never synced. Missing / malformed / disabled storage reads as "no best".
export function loadBestMatchTime(deckId: string): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(BEST_PREFIX + deckId);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function saveBestMatchTime(deckId: string, ms: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(BEST_PREFIX + deckId, String(Math.round(ms)));
  } catch {
    // Quota / private-mode failures are non-fatal — a best time is nice-to-have.
  }
}
