// Persists the Learn settings modal per deck, so a learner who sets "10 cards, written,
// answer with the term" once gets it again next visit. localStorage-only, same rationale
// as lib/quizPreferences.ts — the next device might want a different setup.
//
// Schema version lives in the key; bump it to force a clean slate instead of writing
// migration code for stale shapes.

import { ALL_QUESTION_KINDS, type QuestionKind } from "@/lib/questionTypes";

const STORAGE_PREFIX = "quizanki:learn-prefs:v1:";

// A Learn session asks at least this many cards (user decision 2026-09-14). A deck with
// fewer learnable cards uses all of them.
export const LEARN_MIN_CARDS = 5;

// Which side the learner answers with. "definition" = shown the term, answer with the
// definition (the deck's normal direction). "term" = the reverse.
export type AnswerWith = "definition" | "term";

export interface LearnPreferences {
  // How many cards one session learns. Typed by the learner; never below LEARN_MIN_CARDS.
  count: number;
  // Question formats; each ask picks one. Never empty.
  kinds: QuestionKind[];
  answerWith: AnswerWith;
  // Only cards the learner starred.
  starredOnly: boolean;
  // Off = leave out cards already mastered (seen, mastery 80+).
  includeMastered: boolean;
  // Off = cards come in deck order instead of a random order.
  shuffle: boolean;
  // After a wrong written answer, type the correct answer before moving on.
  retypeWrong: boolean;
  // Written answers forgive small typos (see gradeWritten's typoTolerant option).
  smartGrading: boolean;
  // Read each question aloud when it appears.
  readAloud: boolean;
}

export const DEFAULT_LEARN_PREFS: LearnPreferences = {
  count: LEARN_MIN_CARDS,
  kinds: ["mcq"],
  answerWith: "definition",
  starredOnly: false,
  includeMastered: true,
  shuffle: true,
  retypeWrong: false,
  smartGrading: true,
  readAloud: false,
};

function key(deckId: string): string {
  return `${STORAGE_PREFIX}${deckId}`;
}

/** The saved settings, or null when this deck has none yet (first visit — the Learn page
 * opens the settings modal before starting). SSR / disabled storage also returns null. */
export function loadLearnPreferences(deckId: string): LearnPreferences | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key(deckId));
    if (!raw) return null;
    return sanitizeLearnPreferences(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveLearnPreferences(deckId: string, prefs: LearnPreferences): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key(deckId), JSON.stringify(prefs));
  } catch {
    // Quota / private-mode throws — these prefs are nice-to-have, so swallow.
  }
}

/** Normalises an untrusted stored value. Null when it isn't an object at all. */
export function sanitizeLearnPreferences(value: unknown): LearnPreferences | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const d = DEFAULT_LEARN_PREFS;
  const bool = (x: unknown, fallback: boolean) => (typeof x === "boolean" ? x : fallback);
  const rawKinds = Array.isArray(v.kinds) ? v.kinds : [];
  const kinds = ALL_QUESTION_KINDS.filter((k) => rawKinds.includes(k));
  return {
    count:
      typeof v.count === "number" && Number.isFinite(v.count)
        ? Math.max(LEARN_MIN_CARDS, Math.floor(v.count))
        : d.count,
    kinds: kinds.length > 0 ? kinds : [...d.kinds],
    answerWith: v.answerWith === "term" ? "term" : "definition",
    starredOnly: bool(v.starredOnly, d.starredOnly),
    includeMastered: bool(v.includeMastered, d.includeMastered),
    shuffle: bool(v.shuffle, d.shuffle),
    retypeWrong: bool(v.retypeWrong, d.retypeWrong),
    smartGrading: bool(v.smartGrading, d.smartGrading),
    readAloud: bool(v.readAloud, d.readAloud),
  };
}

/**
 * How many cards a session actually learns: the typed count, raised to the minimum and
 * capped at what's available. A blank / invalid entry means the minimum. A deck with
 * fewer learnable cards than the minimum uses all of them; none available → 0.
 */
export function effectiveLearnCount(requested: number, available: number): number {
  if (available <= 0) return 0;
  const n = Number.isFinite(requested) ? Math.floor(requested) : LEARN_MIN_CARDS;
  return Math.min(available, Math.max(LEARN_MIN_CARDS, n));
}
