// Persists card-sorting progress (the Know / Still-learning piles) per deck, so a
// learner who sorts part of a deck and navigates away can resume the round where
// they left off instead of starting over. localStorage-only, same rationale as
// lib/flashcardPreferences.ts — this is per-device study state that doesn't
// belong on the backend (mirrors the guest-mastery "stays client-side" stance).
//
// Cards are tracked by their build index (the StudyCard `key`), which is stable
// per deck and order-independent, so the piles survive shuffle and subset views.
// Schema version lives in the key; bump it to drop stale shapes instead of
// writing migration code for them.

const STORAGE_PREFIX = "quizanki:flashcard-progress:v1:";

export interface FlashcardProgress {
  // Card keys marked "Know".
  known: number[];
  // Card keys marked "Still learning".
  learn: number[];
}

export const EMPTY_FLASHCARD_PROGRESS: FlashcardProgress = { known: [], learn: [] };

function key(deckId: string): string {
  return `${STORAGE_PREFIX}${deckId}`;
}

/** Best-effort read; SSR / disabled storage / bad JSON all fall back to empty. */
export function loadFlashcardProgress(deckId: string): FlashcardProgress {
  if (typeof window === "undefined") return { known: [], learn: [] };
  try {
    const raw = window.localStorage.getItem(key(deckId));
    if (!raw) return { known: [], learn: [] };
    return sanitize(JSON.parse(raw));
  } catch {
    return { known: [], learn: [] };
  }
}

export function saveFlashcardProgress(deckId: string, progress: FlashcardProgress): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key(deckId), JSON.stringify(progress));
  } catch {
    // Quota / private-mode throws — this progress is a nice-to-have, so swallow.
  }
}

export function clearFlashcardProgress(deckId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key(deckId));
  } catch {
    // Same swallow rationale as saveFlashcardProgress.
  }
}

function sanitize(value: unknown): FlashcardProgress {
  if (!value || typeof value !== "object") return { known: [], learn: [] };
  const v = value as Record<string, unknown>;
  return { known: toKeys(v.known), learn: toKeys(v.learn) };
}

// Coerce persisted data into a clean list of finite integer keys — anything that
// isn't a real card key (strings, NaN, objects from a corrupted write) is dropped.
function toKeys(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((n): n is number => typeof n === "number" && Number.isInteger(n));
}
