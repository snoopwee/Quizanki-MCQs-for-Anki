// Builds multiple-choice questions from a deck's notes. Distractors are always
// drawn from the FULL deck's answer pool (deduplicated, excluding the correct
// value) so a tag-filtered quiz doesn't collapse to a tiny distractor set.

import type { QuizDirection } from "@/types/api";

export interface QuizNote {
  id: string;
  fields: Record<string, string>;
}

export interface QuizConfig {
  questionField: string;
  answerField: string;
  direction?: QuizDirection;
}

export interface Question {
  noteId: string;
  question: string;
  correct: string;
  options: string[];
}

const OPTION_COUNT = 4;

function shuffle<T>(items: T[], rng: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function buildQuestions(
  notes: QuizNote[],
  count: number,
  config: QuizConfig,
  // Distractors come from this pool when the quiz is a filtered subset; defaults
  // to `notes` so callers without a separate pool still work.
  fullPool: QuizNote[] = notes,
  rng: () => number = Math.random,
): Question[] {
  const swap = config.direction === "BACK_TO_FRONT";
  const questionField = swap ? config.answerField : config.questionField;
  const answerField = swap ? config.questionField : config.answerField;

  const allAnswers = Array.from(
    new Set(fullPool.map((n) => n.fields[answerField] ?? "").filter((v) => v.length > 0)),
  );

  const selected = shuffle(notes, rng).slice(0, Math.max(0, count));

  return selected.map((note) => {
    const correct = note.fields[answerField] ?? "";
    const question = note.fields[questionField] ?? "";

    const distractors = shuffle(
      allAnswers.filter((a) => a !== correct),
      rng,
    ).slice(0, OPTION_COUNT - 1);

    return {
      noteId: note.id,
      question,
      correct,
      options: shuffle([correct, ...distractors], rng),
    };
  });
}
