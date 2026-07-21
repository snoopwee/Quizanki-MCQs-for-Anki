// Persists the flashcard-study options (the "Flashcards Options" modal + the
// player's bottom-bar toggles) per deck, so a learner who turns on shuffle or
// switches the starting side once doesn't have to redo it every visit.
// localStorage-only, same rationale as lib/quizPreferences.ts — the next device
// might want a different setup, and none of this belongs on the BE.
//
// Schema version lives in the key; bump it to force a clean slate instead of
// writing migration code for stale shapes.

const STORAGE_PREFIX = "quizanki:flashcard-prefs:v1:";

// Which face shows when you land on a card. "front" = the term/prompt side
// (default), "back" = the definition/answer side first.
export type StartSide = "front" | "back";

export interface FlashcardPreferences {
  startSide: StartSide;
  // Randomise the card order.
  shuffle: boolean;
  // Limit the study set to starred cards only.
  starredOnly: boolean;
  // Card-sorting mode: mark each card Know / Still-learning as you page through.
  cardSorting: boolean;
  // Autoplay cadence: how many seconds each side is held before the player flips /
  // advances. Smaller = faster. Clamped to [1, 15].
  autoplaySeconds: number;
}

export const DEFAULT_FLASHCARD_PREFS: FlashcardPreferences = {
  startSide: "front",
  shuffle: false,
  starredOnly: false,
  cardSorting: false,
  autoplaySeconds: 4,
};

// Speed presets surfaced in the Flashcards Options modal (seconds per side).
export const AUTOPLAY_SPEEDS: Array<{ seconds: number; label: string }> = [
  { seconds: 2, label: "Fast · 2s" },
  { seconds: 4, label: "Normal · 4s" },
  { seconds: 6, label: "Slow · 6s" },
  { seconds: 8, label: "Very slow · 8s" },
];

function key(deckId: string): string {
  return `${STORAGE_PREFIX}${deckId}`;
}

/** Best-effort read; SSR / disabled storage / bad JSON all fall back to defaults. */
export function loadFlashcardPreferences(deckId: string): FlashcardPreferences {
  if (typeof window === "undefined") return { ...DEFAULT_FLASHCARD_PREFS };
  try {
    const raw = window.localStorage.getItem(key(deckId));
    if (!raw) return { ...DEFAULT_FLASHCARD_PREFS };
    return sanitize(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_FLASHCARD_PREFS };
  }
}

export function saveFlashcardPreferences(deckId: string, prefs: FlashcardPreferences): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key(deckId), JSON.stringify(prefs));
  } catch {
    // Quota / private-mode throws — these prefs are nice-to-have, so swallow.
  }
}

function sanitize(value: unknown): FlashcardPreferences {
  const d = DEFAULT_FLASHCARD_PREFS;
  if (!value || typeof value !== "object") return { ...d };
  const v = value as Record<string, unknown>;
  return {
    startSide: v.startSide === "back" ? "back" : "front",
    shuffle: typeof v.shuffle === "boolean" ? v.shuffle : d.shuffle,
    starredOnly: typeof v.starredOnly === "boolean" ? v.starredOnly : d.starredOnly,
    cardSorting: typeof v.cardSorting === "boolean" ? v.cardSorting : d.cardSorting,
    autoplaySeconds:
      typeof v.autoplaySeconds === "number" && v.autoplaySeconds >= 1 && v.autoplaySeconds <= 15
        ? v.autoplaySeconds
        : d.autoplaySeconds,
  };
}
