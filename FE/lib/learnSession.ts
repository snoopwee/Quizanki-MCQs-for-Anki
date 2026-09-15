// Learn mode's session engine — pure, no React or I/O, deterministic given an rng.
//
// A session learns N cards picked the way the quiz picks them. Each time a card comes up
// it's asked in one of the learner's enabled question types. A correct answer learns the
// card. A miss, when missed cards come back (the default), sends it back REQUEUE_GAP
// places, to be asked again (possibly in another type) until it's answered correctly;
// otherwise the card is done either way. The session is complete once no card is left to
// ask. Every answer — first try or repeat — is recorded and moves mastery like a quiz
// answer; the recording itself lives with the screen.

import { askCard, type CardTemplate, type NoteTypeQuizSpec, type Question } from "@/lib/buildQuestions";
import { assignQuestionKind, type QuestionKind } from "@/lib/questionTypes";
import {
  collectAllNoteIds,
  collectMasteredIds,
  collectStarredIds,
  countCardsIn,
  totalCardsAcrossTypes,
  type NoteStatsLookup,
} from "@/lib/quizDeckSpecs";
import { classifyMastery, type MasteryStage } from "@/lib/masteryStage";
import type { AnswerWith } from "@/lib/learnPreferences";
import type { ApkgNoteType } from "@/types/api";

// How many other cards come up before a missed card returns (sooner when fewer are left).
export const REQUEUE_GAP = 2;

export interface LearnCard {
  template: CardTemplate;
  // Times this card has been answered, and how many of those were wrong.
  attempts: number;
  misses: number;
  learned: boolean;
}

export interface LearnSession {
  cards: LearnCard[];
  // Indexes into `cards` still to learn, in the order they'll come up. The head is the
  // card on screen.
  queue: number[];
  // The question on screen (for `queue[0]`), or null once every card is learned.
  current: Question | null;
  // Answers so far. Changes on every advance, so a screen can use it as a reset key.
  asked: number;
  kinds: QuestionKind[];
  // Whether a missed card comes back until it's answered correctly.
  retryMissed: boolean;
}

export interface LearnSummary {
  total: number;
  // Cards answered correctly the first time they came up.
  firstTry: number;
  // Every answer given, repeats included.
  answers: number;
  // Cards missed at least once, most misses first.
  missed: LearnCard[];
  // Whether missed cards came back — so every card ended up learned.
  retriedMissed: boolean;
}

function shuffled<T>(items: T[], rng: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// The types a card can be asked in. Multiple choice and true/false need at least one
// distractor — a one-option question or an always-true statement teaches nothing — so a
// card without any is asked written instead.
export function kindsForCard(card: CardTemplate, enabled: QuestionKind[]): QuestionKind[] {
  if (card.distractors.length === 0) return ["written"];
  return enabled.length > 0 ? enabled : ["mcq"];
}

function askHead(cards: LearnCard[], queue: number[], kinds: QuestionKind[], rng: () => number): Question | null {
  if (queue.length === 0) return null;
  const card = cards[queue[0]].template;
  return askCard(card, assignQuestionKind(kindsForCard(card, kinds), rng), rng);
}

export function startLearnSession(
  templates: CardTemplate[],
  kinds: QuestionKind[],
  options: { shuffle: boolean; retryMissed?: boolean },
  rng: () => number = Math.random,
): LearnSession {
  const cards: LearnCard[] = templates.map((template) => ({
    template,
    attempts: 0,
    misses: 0,
    learned: false,
  }));
  const indexes = cards.map((_, i) => i);
  const queue = options.shuffle
    ? shuffled(indexes, rng)
    : indexes.sort((a, b) => cards[a].template.order - cards[b].template.order);
  return {
    cards,
    queue,
    current: askHead(cards, queue, kinds, rng),
    asked: 0,
    kinds,
    retryMissed: options.retryMissed ?? true,
  };
}

// The same session with the card on screen asked afresh — for a restored session whose saved
// question can't be trusted.
export function reaskLearnCard(session: LearnSession, rng: () => number = Math.random): LearnSession {
  return { ...session, current: askHead(session.cards, session.queue, session.kinds, rng) };
}

// Records the answer to the card on screen and moves on: a correct answer learns it, a
// miss puts it back REQUEUE_GAP places later (or, with retryMissed off, lets it go). A
// complete session is returned unchanged.
export function answerLearnCard(
  session: LearnSession,
  correct: boolean,
  rng: () => number = Math.random,
): LearnSession {
  if (session.queue.length === 0) return session;
  const [head, ...rest] = session.queue;
  const cards = session.cards.map((card, i) =>
    i === head
      ? {
          ...card,
          attempts: card.attempts + 1,
          misses: card.misses + (correct ? 0 : 1),
          learned: correct,
        }
      : card,
  );
  const queue =
    correct || !session.retryMissed
      ? rest
      : [...rest.slice(0, REQUEUE_GAP), head, ...rest.slice(REQUEUE_GAP)];
  return {
    ...session,
    cards,
    queue,
    current: askHead(cards, queue, session.kinds, rng),
    asked: session.asked + 1,
  };
}

// `learned` = answered correctly; `done` = no longer coming up. The two match when missed
// cards come back (the queue holds each unlearned card exactly once).
export function learnProgress(session: LearnSession): { learned: number; done: number; total: number } {
  return {
    learned: session.cards.filter((card) => card.learned).length,
    done: session.cards.length - session.queue.length,
    total: session.cards.length,
  };
}

export function summarizeLearnSession(session: LearnSession): LearnSummary {
  const missed = session.cards
    .filter((card) => card.misses > 0)
    .sort((a, b) => b.misses - a.misses || a.template.order - b.template.order);
  return {
    total: session.cards.length,
    firstTry: session.cards.length - missed.length,
    answers: session.cards.reduce((sum, card) => sum + card.attempts, 0),
    missed,
    retriedMissed: session.retryMissed,
  };
}

// The specs for a session. "definition" keeps the deck's direction (the quiz's field
// picks); "term" swaps each basic type's answer with its first prompt field. A cloze card
// has no reverse, so it's asked as it is.
export function learnSpecs(specs: NoteTypeQuizSpec[], answerWith: AnswerWith): NoteTypeQuizSpec[] {
  if (answerWith === "definition") return specs;
  return specs.map((spec) =>
    spec.kind === "basic" && spec.questionFields.length > 0
      ? { ...spec, questionFields: [spec.answerField], answerField: spec.questionFields[0] }
      : spec,
  );
}

// The note keys a session may ask, or undefined for "every card". Starred only keeps the
// starred ones; leaving out mastered cards drops those already mastered. Both combine.
export function learnEligibleIds(
  types: ApkgNoteType[],
  getStats: NoteStatsLookup | undefined,
  filters: { starredOnly: boolean; includeMastered: boolean },
): Set<string> | undefined {
  if (!filters.starredOnly && filters.includeMastered) return undefined;
  const base = filters.starredOnly ? collectStarredIds(types, getStats) : collectAllNoteIds(types);
  if (filters.includeMastered) return base;
  const mastered = collectMasteredIds(types, getStats);
  return new Set([...base].filter((id) => !mastered.has(id)));
}

// Cards available to learn — a cloze note counts once per deletion.
export function countLearnableCards(types: ApkgNoteType[], eligible?: Set<string>): number {
  return eligible ? countCardsIn(types, eligible) : totalCardsAcrossTypes(types);
}

// How many of the session's cards sit in each mastery stage, from a mastery lookup.
export function stageCounts(
  cards: LearnCard[],
  lookup: (noteId: string) => { mastery?: number; timesSeen?: number } | undefined,
): Record<MasteryStage, number> {
  const counts: Record<MasteryStage, number> = { new: 0, learning: 0, practicing: 0, mastered: 0 };
  for (const card of cards) {
    counts[classifyMastery(lookup(card.template.base.noteId)).stage] += 1;
  }
  return counts;
}
