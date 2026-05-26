"use client";

import { useQuizStore } from "@/stores/quizStore";
import { useRecordAnswer } from "@/hooks/useQuizSession";
import { ProgressBar } from "./ProgressBar";
import { QuestionCard } from "./QuestionCard";
import { OptionButton } from "./OptionButton";
import { ResultsSummary } from "./ResultsSummary";

export function QuizSession({
  onRetry,
  onExit,
}: {
  onRetry: () => void;
  onExit: () => void;
}) {
  const questions = useQuizStore((s) => s.questions);
  const currentIndex = useQuizStore((s) => s.currentIndex);
  const selectedAnswer = useQuizStore((s) => s.selectedAnswer);
  const score = useQuizStore((s) => s.score);
  const answers = useQuizStore((s) => s.answers);
  const sessionId = useQuizStore((s) => s.sessionId);
  const selectAnswer = useQuizStore((s) => s.selectAnswer);
  const nextQuestion = useQuizStore((s) => s.nextQuestion);

  const recordAnswer = useRecordAnswer();

  const finished = currentIndex >= questions.length;

  if (finished) {
    return (
      <ResultsSummary
        answers={answers}
        score={score}
        total={questions.length}
        onRetry={onRetry}
        onNewDeck={onExit}
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
    <div className="space-y-5">
      <ProgressBar current={currentIndex} total={questions.length} />
      <QuestionCard prompt={question.prompt} />

      <div className="space-y-2">
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

      {answered && (
        <button
          type="button"
          onClick={nextQuestion}
          className="w-full rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
        >
          {isLast ? "See results" : "Next question"}
        </button>
      )}
    </div>
  );
}
