// Pure answer-state rules shared by every screen that asks quiz questions (the quiz today,
// Learn next). The renderers in `components/quiz/questions/` stay dumb; which answer is
// right, how a true/false pick is labelled, and what the footer says live here, testable
// in isolation. Grading a typed answer is `gradeWritten` in `questionTypes.ts`.

import type { Question } from "@/lib/buildQuestions";
import type { QuestionKind } from "@/lib/questionTypes";

// A checked written answer: the auto-grade, plus whether the learner overrode a miss
// ("I was right"). The final verdict is only recorded when they move on, so an override
// changes the one recorded result instead of adding a second.
export interface WrittenResult {
  autoCorrect: boolean;
  override: boolean;
}

// The value a true/false pick is recorded and displayed as.
export function trueFalseLabel(pick: boolean): "True" | "False" {
  return pick ? "True" : "False";
}

// A written answer counts once auto-graded correct or overridden. Unchecked never counts.
export function writtenIsCorrect(result: WrittenResult | null): boolean {
  return result ? result.autoCorrect || result.override : false;
}

// Whether the answer on screen is right. `selected` is the recorded pick — the option for
// multiple choice, "True" / "False" for true/false; a written question reads its checked
// result instead.
export function isAnswerCorrect(
  question: Question,
  selected: string | null,
  writtenResult: WrittenResult | null,
): boolean {
  if (question.kind === "written") return writtenIsCorrect(writtenResult);
  if (question.kind === "truefalse") return selected === trueFalseLabel(question.truth);
  return selected === question.correct;
}

// The footer prompt shown before the question is answered.
export function answerHint(kind: QuestionKind): string {
  if (kind === "written") return "Type your answer";
  if (kind === "truefalse") return "True or false?";
  return "Pick the closest answer";
}
