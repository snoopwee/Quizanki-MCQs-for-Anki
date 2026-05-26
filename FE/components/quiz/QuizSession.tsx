"use client";

import { useQuizStore } from "@/stores/quizStore";
import { useRecordAnswer } from "@/hooks/useQuizSession";
import { reshuffleQuestions } from "@/lib/buildQuestions";
import { ProgressBar } from "./ProgressBar";
import { QuestionCard } from "./QuestionCard";
import { OptionButton } from "./OptionButton";
import { ResultsSummary } from "./ResultsSummary";

export function QuizSession({
  onRetry,
  onExit,
  onOpenSettings,
}: {
  onRetry: () => void;
  onExit: () => void;
  // When provided, a Settings button appears during the active quiz (opens the
  // setting modal). Omitted by the saved-deck quiz, which has no live settings.
  onOpenSettings?: () => void;
}) {
  const questions = useQuizStore((s) => s.questions);
  const currentIndex = useQuizStore((s) => s.currentIndex);
  const selectedAnswer = useQuizStore((s) => s.selectedAnswer);
  const score = useQuizStore((s) => s.score);
  const answers = useQuizStore((s) => s.answers);
  const sessionId = useQuizStore((s) => s.sessionId);
  const startStoreSession = useQuizStore((s) => s.startSession);
  const selectAnswer = useQuizStore((s) => s.selectAnswer);
  const nextQuestion = useQuizStore((s) => s.nextQuestion);

  const recordAnswer = useRecordAnswer();

  const finished = currentIndex >= questions.length;

  if (finished) {
    // Same/wrong-only replays run locally (empty sessionId), so they don't append
    // answers to an already-finished backend session. "New test" is a full rebuild
    // delegated to the parent (re-shuffles cards, creates a fresh session).
    const retakeSame = () => startStoreSession(reshuffleQuestions(questions), "");
    const retakeWrong = () => {
      const wrongIds = new Set(answers.filter((a) => !a.wasCorrect).map((a) => a.noteId));
      startStoreSession(
        reshuffleQuestions(questions.filter((q) => wrongIds.has(q.noteId))),
        "",
      );
    };

    return (
      <ResultsSummary
        answers={answers}
        score={score}
        total={questions.length}
        onRetakeSame={retakeSame}
        onRetakeWrong={retakeWrong}
        onRetakeNew={onRetry}
        onBackToDeck={onExit}
      />
    );
  }

  const question = questions[currentIndex];
  const answered = selectedAnswer !== null;
  const isLast = currentIndex === questions.length - 1;

  function handleSelect(option: string) {
    if (answered) return;
    selectAnswer(option);
    if (sessionId) {
      recordAnswer.mutate({
        sessionId,
        noteId: question.noteId,
        correct: option === question.correct,
      });
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onExit}
          className="text-sm text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
        >
          ← End quiz
        </button>
        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            ⚙ Settings
          </button>
        )}
      </div>
      <ProgressBar current={currentIndex} total={questions.length} />

      {/* One rectangle: a larger question area on the left, answers (2×2) plus the
          Next button on the right. The answer column is a fixed width so widening
          the page only grows the question side. Fixed height keeps the card from
          stretching — long question/answers scroll within their own region. */}
      <div className="grid h-[30rem] items-stretch overflow-hidden rounded-xl border border-neutral-200 md:grid-cols-[1fr_24rem] dark:border-neutral-800">
        <div className="min-h-0 overflow-hidden border-b border-neutral-200 p-8 md:border-r md:border-b-0 dark:border-neutral-800">
          <QuestionCard prompt={question.prompt} />
        </div>

        <div className="flex min-h-0 flex-col gap-4 overflow-hidden p-6">
          <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-3">
            {question.options.map((option) => (
              <OptionButton
                key={option}
                option={option}
                answered={answered}
                isCorrect={option === question.correct}
                isSelected={option === selectedAnswer}
                onSelect={() => handleSelect(option)}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={nextQuestion}
            disabled={!answered}
            className="w-full rounded-md bg-black px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-40 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
          >
            {isLast ? "See results" : "Next question"}
          </button>
        </div>
      </div>
    </div>
  );
}
