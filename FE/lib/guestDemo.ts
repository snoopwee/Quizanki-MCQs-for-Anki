// The guest demo: what somebody without an account gets on a deck.
//
// The shape, decided 2026-10-19: flashcards are open so a guest can read the cards and judge
// whether the deck is any good, plus ONE preset quiz per deck. Choosing question types, counts
// and field mappings is the thing an account buys — so the demo deliberately has no setup screen.
// Match stays signed-in only.
//
// The same rules apply to a deck a guest uploaded on the landing page and to one they opened from
// a share link. Two guest models would be two things to explain and two to keep working.

import {
  buildAllCardsSpecs,
  initialPrefsByType,
  isQuizable,
  totalCardsAcrossTypes,
  type NoteStatsLookup,
} from "@/lib/quizDeckSpecs";
import { buildMixedQuestions, type Question } from "@/lib/buildQuestions";
import type { ApkgParseResponse } from "@/types/api";

/**
 * How many questions the demo run asks.
 *
 * <p>Short enough that a visitor actually reaches the end — which is where the sign-up prompt
 * lives, so an abandoned run converts nobody — and long enough to show the distractors doing
 * something interesting. Capped by the deck: a five-card deck asks five.
 */
export const GUEST_DEMO_QUESTIONS = 10;

/** Which deck a demo belongs to. Both surfaces need a stable key, by different means. */
export type GuestDemoSource =
  | { kind: "shared"; deckId: string }
  | { kind: "upload"; filename: string; noteCount: number };

/**
 * The key a used demo is remembered under — one free run per deck.
 *
 * <p>A shared deck has a real id. An uploaded file has none, so it is identified by name and size;
 * re-uploading the same file is the same deck and does not hand out a second run, while a
 * different deck does. Both are namespaced so an uploaded file called like a UUID cannot collide
 * with a shared deck.
 *
 * <p><b>This is a nudge, not a lock.</b> It lives in localStorage, so clearing storage or opening
 * a private window resets it. That is the right strength: the cards are served by a public,
 * unauthenticated endpoint already, so there is nothing here to defend — the limit exists to
 * create a natural moment to ask for the sign-up, not to withhold content.
 */
export function guestDemoKey(source: GuestDemoSource): string {
  if (source.kind === "shared") return `shared:${source.deckId}`;
  return `upload:${source.filename}:${source.noteCount}`;
}

/** Has this deck already had its one free run? */
export function hasUsedDemo(used: Readonly<Record<string, number>>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(used, key);
}

/**
 * The preset quiz, built with no questions asked.
 *
 * <p>Every choice here is the one the setup screen would have defaulted to — multiple choice,
 * every card eligible, fields auto-detected per note type — so the demo is the product's own
 * recommended configuration rather than a cut-down version of it. The learner is not being shown
 * something worse; they are being shown it without the controls.
 *
 * <p>Returns an empty array when the deck has nothing askable (no quizable note type, or no field
 * pair could be detected). Callers must treat that as "no demo available" rather than starting an
 * empty session.
 */
export function buildGuestPresetQuiz(
  parsed: ApkgParseResponse,
  options: { rng?: () => number; getStats?: NoteStatsLookup } = {},
): Question[] {
  const quizable = parsed.noteTypes.filter(isQuizable);
  if (quizable.length === 0) return [];

  // Cloze types carry their own field detection inside buildAllCardsSpecs; only basic types need
  // a question/answer pair chosen for them.
  const basicTypes = quizable.filter((nt) => !nt.cloze);
  const specs = buildAllCardsSpecs(quizable, initialPrefsByType(basicTypes, null), options.getStats);
  if (specs.length === 0) return [];

  const available = totalCardsAcrossTypes(quizable);
  const count = Math.min(GUEST_DEMO_QUESTIONS, available);
  if (count <= 0) return [];

  return buildMixedQuestions(specs, count, options.rng, undefined, ["mcq"]);
}
