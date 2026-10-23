"use client";

import { useMemo, useState } from "react";
import { QuestionCard } from "@/components/quiz/QuestionCard";
import { QuestionBody } from "@/components/quiz/questions/QuestionBody";
import { Icon } from "@/components/ui/icons";
import { buttonClasses } from "@/components/ui/Button";
import {
  answeredCount,
  clampIndex,
  gradePracticeTest,
  unansweredIndexes,
  type PracticeAnswer,
  type PracticeScore,
} from "@/lib/practiceTest";
import { trueFalseLabel } from "@/lib/questionAnswer";
import type { Question } from "@/lib/buildQuestions";

/**
 * The paper. Answer everything, move around freely, submit once, then it is graded.
 *
 * <p>No feedback until submit — that is the entire point of the mode, so every renderer is given
 * {@code answered={false}} for the whole sitting. {@link QuestionBody} and its children already
 * treat that as "not graded yet"; the only thing they were missing was a way to show a pick
 * without grading it, which is the `showChosen` state added to `OptionButton`/`TrueFalseChoice`.
 *
 * <p>Written questions skip their "Check" button here for the same reason: checking reveals the
 * answer. The typed text is held and graded at the end.
 */
export function PracticeTestSession({
  questions,
  onSubmit,
  onExit,
}: {
  questions: Question[];
  /** Called once with the graded paper. The page decides what to record and what to show. */
  onSubmit: (score: PracticeScore, answers: PracticeAnswer[]) => void;
  onExit: () => void;
}) {
  const [answers, setAnswers] = useState<PracticeAnswer[]>(() => questions.map(() => null));
  const [index, setIndex] = useState(0);
  // Submitting a half-finished paper is allowed, but not by accident.
  const [confirming, setConfirming] = useState(false);

  const total = questions.length;
  const question = questions[index]!;
  const done = answeredCount(answers, total);
  const blanks = useMemo(() => unansweredIndexes(answers, total), [answers, total]);

  function setAnswer(value: PracticeAnswer) {
    setAnswers((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  function go(delta: number) {
    setIndex((i) => clampIndex(i + delta, total));
  }

  function submit() {
    onSubmit(gradePracticeTest(questions, answers), answers);
  }

  function handleSubmitClick() {
    if (blanks.length > 0 && !confirming) {
      setConfirming(true);
      return;
    }
    submit();
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-8rem)] w-full max-w-3xl flex-col">
      {/* top bar: exit · progress · answered counter */}
      <div className="flex shrink-0 items-center gap-3 border-b border-line pb-4">
        <button
          type="button"
          onClick={onExit}
          title="Leave the test"
          aria-label="Leave the test"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-input border border-line bg-surface text-muted transition hover:text-ink"
        >
          <Icon name="x" size={17} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center justify-between font-mono text-xs text-muted">
            <span>Practice test</span>
            <span className="font-bold text-ink">
              {done} of {total} answered
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-300"
              style={{ width: `${total === 0 ? 0 : (done / total) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* the question. `answered={false}` throughout — nothing is graded until submit. */}
      <div className="flex min-h-0 flex-1 flex-col justify-center py-8">
        <p className="mb-3 text-center font-mono text-xs uppercase tracking-wide text-faint">
          Question {index + 1} of {total}
        </p>
        <QuestionCard prompt={question.prompt} />
        <div className="mt-6">
          <QuestionBody
            question={question}
            answered={false}
            selected={answers[index] ?? null}
            onPickOption={(option) => setAnswer(option)}
            onPickTrueFalse={(pick) => setAnswer(trueFalseLabel(pick))}
            writtenInput={answers[index] ?? ""}
            onWrittenInput={(value) => setAnswer(value)}
            // No checking mid-test: a "Check" button would reveal the answer, which is exactly
            // what this mode withholds. Graded with everything else at the end.
            writtenResult={null}
            onCheckWritten={() => {}}
            onToggleOverride={() => {}}
          />
        </div>
      </div>

      {/* navigator: every question, answered state visible, all of them reachable */}
      <div className="shrink-0 border-t border-line pt-4">
        <ol className="mb-4 flex flex-wrap gap-1.5" aria-label="Jump to a question">
          {questions.map((_, i) => {
            const isAnswered = (answers[i] ?? "").trim() !== "";
            const isCurrent = i === index;
            return (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-current={isCurrent ? "step" : undefined}
                  aria-label={`Question ${i + 1}${isAnswered ? ", answered" : ", not answered"}`}
                  className={`focus-ring h-7 w-7 rounded-input border font-mono text-xs font-semibold transition ${
                    isCurrent
                      ? "border-accent bg-accent text-white"
                      : isAnswered
                        ? "border-accent/40 bg-accent-soft text-accent-ink"
                        : "border-line bg-surface text-faint hover:border-line-strong hover:text-ink"
                  }`}
                >
                  {i + 1}
                </button>
              </li>
            );
          })}
        </ol>

        {confirming && (
          <p className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-input border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
            <Icon name="alertTriangle" size={14} />
            {blanks.length} question{blanks.length === 1 ? " is" : "s are"} still blank — blanks
            are marked wrong.
            <button
              type="button"
              onClick={() => {
                setIndex(blanks[0]!);
                setConfirming(false);
              }}
              className="font-semibold underline underline-offset-2"
            >
              Go to the first
            </button>
            <span aria-hidden>·</span>
            <button type="button" onClick={submit} className="font-semibold underline underline-offset-2">
              Submit anyway
            </button>
          </p>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => go(-1)}
            disabled={index === 0}
            className={buttonClasses({ variant: "ghost", size: "sm" })}
          >
            <Icon name="chevronLeft" size={15} /> Previous
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            disabled={index >= total - 1}
            className={buttonClasses({ variant: "ghost", size: "sm" })}
          >
            Next <Icon name="chevronRight" size={15} />
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={handleSubmitClick}
            className={buttonClasses({ variant: "primary" })}
          >
            Submit test
          </button>
        </div>
      </div>
    </div>
  );
}
