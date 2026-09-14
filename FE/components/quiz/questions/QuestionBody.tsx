import type { Question } from "@/lib/buildQuestions";
import type { WrittenResult } from "@/lib/questionAnswer";
import { McqChoices } from "./McqChoices";
import { TrueFalseChoice } from "./TrueFalseChoice";
import { WrittenAnswer } from "./WrittenAnswer";

// The answer area for one question, in its format (multiple choice / true-false / written).
// Shared by the quiz and Learn: it only renders and reports what the learner did — grading
// (`lib/questionAnswer.ts`), recording and moving on stay with the screen that owns the
// session. The prompt above it is `QuestionCard`.
export function QuestionBody({
  question,
  answered,
  selected,
  onPickOption,
  onPickTrueFalse,
  writtenInput,
  onWrittenInput,
  writtenResult,
  onCheckWritten,
  onToggleOverride,
}: {
  question: Question;
  answered: boolean;
  // The recorded pick: the option for multiple choice, "True" / "False" for true/false.
  selected: string | null;
  onPickOption: (option: string) => void;
  onPickTrueFalse: (pick: boolean) => void;
  // Written questions only — state from `useWrittenAnswer`.
  writtenInput: string;
  onWrittenInput: (value: string) => void;
  writtenResult: WrittenResult | null;
  onCheckWritten: () => void;
  onToggleOverride: () => void;
}) {
  if (question.kind === "mcq") {
    return (
      <McqChoices
        options={question.options}
        correct={question.correct}
        selected={selected}
        answered={answered}
        onSelect={onPickOption}
      />
    );
  }

  if (question.kind === "truefalse") {
    return (
      <TrueFalseChoice
        statement={question.statement}
        truth={question.truth}
        answered={answered}
        picked={selected}
        onPick={onPickTrueFalse}
      />
    );
  }

  return (
    <WrittenAnswer
      input={writtenInput}
      onInput={onWrittenInput}
      onCheck={onCheckWritten}
      result={writtenResult}
      correct={question.correct}
      onToggleOverride={onToggleOverride}
    />
  );
}
