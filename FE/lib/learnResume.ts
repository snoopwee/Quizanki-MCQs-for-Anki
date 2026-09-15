// Saves a Learn session in progress per deck, so leaving mid-session (back to the deck, a
// refresh, a closed tab) picks it up where the learner left off instead of dealing a new
// set. localStorage-only, like the other per-device study state in lib/ — the answers
// themselves are already recorded on the server as they land.
//
// Schema version lives in the key; bump it to drop stale shapes instead of migrating them.

import type { BaseQuestion, CardTemplate, Question } from "@/lib/buildQuestions";
import { sanitizeLearnPreferences, type LearnPreferences } from "@/lib/learnPreferences";
import { answerLearnCard, reaskLearnCard, type LearnCard, type LearnSession } from "@/lib/learnSession";
import { ALL_QUESTION_KINDS } from "@/lib/questionTypes";

const STORAGE_PREFIX = "quizanki:learn-resume:v1:";

// A save older than this starts fresh — a week-old set is no longer "where you left off".
export const LEARN_RESUME_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface LearnSnapshot {
  savedAt: number;
  // The backend session id, reused so resumed answers chart as the same session.
  sessionId: string;
  prefs: LearnPreferences;
  session: LearnSession;
  // A multiple choice / true-false pick already recorded for the card on screen before
  // Next was pressed (null when none). Applied on restore, so that answer is never asked —
  // or recorded — twice.
  pending: boolean | null;
}

export interface RestoredLearn {
  sessionId: string;
  prefs: LearnPreferences;
  // May already be complete, when a pending pick answered the last card.
  session: LearnSession;
}

function key(deckId: string): string {
  return `${STORAGE_PREFIX}${deckId}`;
}

export function saveLearnSnapshot(deckId: string, snapshot: LearnSnapshot): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key(deckId), JSON.stringify(snapshot));
  } catch {
    // Quota / private-mode throws — resuming is a nice-to-have, so swallow.
  }
}

export function clearLearnSnapshot(deckId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key(deckId));
  } catch {
    // Same swallow rationale as saveLearnSnapshot.
  }
}

/** The saved session for this deck, or null (none, stale, or unreadable — a bad save is
 * dropped). `noteIds` is every note the deck can ask now. */
export function loadLearnSnapshot(deckId: string, noteIds: Set<string>, now = Date.now()): RestoredLearn | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key(deckId));
    if (!raw) return null;
    const restored = restoreLearnSnapshot(JSON.parse(raw), noteIds, now);
    if (!restored) clearLearnSnapshot(deckId);
    return restored;
  } catch {
    return null;
  }
}

/**
 * Validates an untrusted stored snapshot. Null when it's too old, malformed, finished, or
 * asks a note the deck no longer has (a card was deleted since). A saved question that
 * doesn't fit its card is asked afresh rather than dropping the whole session.
 */
export function restoreLearnSnapshot(
  value: unknown,
  noteIds: Set<string>,
  now: number,
  rng: () => number = Math.random,
): RestoredLearn | null {
  if (!isRecord(value)) return null;
  const { savedAt, sessionId } = value;
  if (typeof savedAt !== "number" || !Number.isFinite(savedAt) || now - savedAt > LEARN_RESUME_MAX_AGE_MS) {
    return null;
  }
  if (typeof sessionId !== "string" || sessionId === "") return null;
  const prefs = sanitizeLearnPreferences(value.prefs);
  if (!prefs) return null;
  const session = restoreSession(value.session, noteIds, rng);
  if (!session) return null;
  return {
    sessionId,
    prefs,
    session: typeof value.pending === "boolean" ? answerLearnCard(session, value.pending, rng) : session,
  };
}

function restoreSession(value: unknown, noteIds: Set<string>, rng: () => number): LearnSession | null {
  if (!isRecord(value) || !Array.isArray(value.cards) || !Array.isArray(value.queue)) return null;
  const cards: LearnCard[] = [];
  for (const raw of value.cards) {
    const card = restoreCard(raw);
    if (!card || !noteIds.has(card.template.base.noteId)) return null;
    cards.push(card);
  }
  const queue: unknown[] = value.queue;
  // A finished session is never saved, so an empty queue is a bad save.
  if (cards.length === 0 || queue.length === 0) return null;
  const validQueue = queue.every((i) => isCount(i) && i < cards.length) && new Set(queue).size === queue.length;
  if (!validQueue || !isCount(value.asked)) return null;
  const rawKinds = Array.isArray(value.kinds) ? value.kinds : [];
  const kinds = ALL_QUESTION_KINDS.filter((k) => rawKinds.includes(k));
  if (kinds.length === 0) return null;

  const session: LearnSession = {
    cards,
    queue: queue as number[],
    current: null,
    asked: value.asked,
    kinds,
    retryMissed: typeof value.retryMissed === "boolean" ? value.retryMissed : true,
  };
  const current = restoreQuestion(value.current, cards[session.queue[0]].template);
  return current ? { ...session, current } : reaskLearnCard(session, rng);
}

function restoreCard(value: unknown): LearnCard | null {
  if (!isRecord(value) || !isRecord(value.template)) return null;
  const { template, attempts, misses, learned } = value;
  const base = template.base;
  if (typeof template.key !== "string" || typeof template.order !== "number" || !isStringArray(template.distractors)) {
    return null;
  }
  if (!isRecord(base) || typeof base.noteId !== "string" || typeof base.question !== "string") return null;
  if (typeof base.correct !== "string" || !Array.isArray(base.prompt)) return null;
  const prompt: BaseQuestion["prompt"] = [];
  for (const segment of base.prompt) {
    if (!isRecord(segment) || typeof segment.label !== "string" || typeof segment.value !== "string") return null;
    prompt.push({ label: segment.label, value: segment.value });
  }
  if (!isCount(attempts) || !isCount(misses) || typeof learned !== "boolean") return null;
  const restored: CardTemplate = {
    key: template.key,
    order: template.order,
    base: { noteId: base.noteId, prompt, question: base.question, correct: base.correct },
    distractors: [...template.distractors],
  };
  return { template: restored, attempts, misses, learned };
}

// The saved on-screen question, rebuilt on its card's own fields — or null when it doesn't
// belong to that card or its payload is broken.
function restoreQuestion(value: unknown, card: CardTemplate): Question | null {
  if (!isRecord(value) || value.noteId !== card.base.noteId) return null;
  if (value.kind === "mcq" && isStringArray(value.options) && value.options.includes(card.base.correct)) {
    return { ...card.base, kind: "mcq", options: [...value.options] };
  }
  if (value.kind === "truefalse" && typeof value.statement === "string" && typeof value.truth === "boolean") {
    return { ...card.base, kind: "truefalse", statement: value.statement, truth: value.truth };
  }
  if (value.kind === "written") return { ...card.base, kind: "written" };
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}
