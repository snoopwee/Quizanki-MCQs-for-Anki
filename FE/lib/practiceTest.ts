// Practice Test: a fixed-length paper you answer in full, then submit, then get scored.
//
// HOW IT DIFFERS FROM THE QUIZ, which is the whole reason it exists:
//   Quiz           one card at a time · instant feedback · no going back · locked on answer
//   Practice Test  the whole paper    · no feedback until you submit · move freely · change
//                  your mind · leave blanks
//
// The quiz teaches; the test measures. Showing whether you were right after every question makes
// the second impossible, which is why this cannot be a flag on the quiz.
//
// Everything here is pure so the grading and the navigation rules are testable without rendering
// a paper. The renderers, the question builder and the results screen are all reused as they are.

import type { Question } from "@/lib/buildQuestions";
import { gradeWritten } from "@/lib/questionTypes";
import { trueFalseLabel } from "@/lib/questionAnswer";

/** One response. `null` is a deliberate blank — the learner may leave questions unanswered. */
export type PracticeAnswer = string | null;

export interface PracticeResult {
  question: Question;
  /** What they put down, or null for a blank. */
  answer: PracticeAnswer;
  correct: boolean;
  /** True when they left it blank. A blank is wrong, but it is not a mistake worth studying. */
  blank: boolean;
}

export interface PracticeScore {
  results: PracticeResult[];
  correct: number;
  total: number;
  /** Whole percent, 0 when the paper is empty so the results screen never shows NaN%. */
  percent: number;
  blanks: number;
}

/**
 * Grade one answer.
 *
 * <p>Written answers are graded with the same matcher the quiz uses, WITHOUT typo tolerance:
 * smart grading is a Learn affordance, and a test that forgives spelling is measuring something
 * else. Multiple choice and true/false compare exactly as they do everywhere else.
 */
export function gradePracticeAnswer(question: Question, answer: PracticeAnswer): boolean {
  if (answer === null) return false;
  if (question.kind === "written") return gradeWritten(answer, question.correct);
  if (question.kind === "truefalse") return answer === trueFalseLabel(question.truth);
  return answer === question.correct;
}

/**
 * Grade the whole paper.
 *
 * <p>`answers` is positional — index i is the response to question i — and may be shorter than
 * the paper or contain holes; anything missing counts as a blank rather than throwing, because
 * the only way to produce a mismatch is a bug and a blank screen helps nobody diagnose it.
 */
export function gradePracticeTest(
  questions: Question[],
  answers: readonly PracticeAnswer[],
): PracticeScore {
  const results = questions.map((question, i) => {
    const answer = answers[i] ?? null;
    const blank = answer === null || (typeof answer === "string" && answer.trim() === "");
    return {
      question,
      answer,
      blank,
      correct: blank ? false : gradePracticeAnswer(question, answer),
    };
  });

  const correct = results.filter((r) => r.correct).length;
  const total = results.length;
  return {
    results,
    correct,
    total,
    percent: total === 0 ? 0 : Math.round((correct / total) * 100),
    blanks: results.filter((r) => r.blank).length,
  };
}

/** How many questions have a response. Drives the "7 of 10 answered" counter. */
export function answeredCount(answers: readonly PracticeAnswer[], total: number): number {
  let n = 0;
  for (let i = 0; i < total; i++) {
    const a = answers[i] ?? null;
    if (a !== null && a.trim() !== "") n++;
  }
  return n;
}

/** Positions still blank, in order — what "Jump to the first unanswered" uses. */
export function unansweredIndexes(answers: readonly PracticeAnswer[], total: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < total; i++) {
    const a = answers[i] ?? null;
    if (a === null || a.trim() === "") out.push(i);
  }
  return out;
}

/**
 * Where "next" and "previous" land. Clamped rather than wrapping: on a paper you can see the
 * end of, silently looping from the last question back to the first reads as a glitch.
 */
export function clampIndex(index: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(Math.max(index, 0), total - 1);
}
