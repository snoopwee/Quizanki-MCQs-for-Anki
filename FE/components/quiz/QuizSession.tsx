"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useQuizStore } from "@/stores/quizStore";
import { useGuestMastery } from "@/stores/guestMasteryStore";
import { useRecordAnswer } from "@/hooks/useQuizSession";
import { cancelSpeech } from "@/lib/tts";
import { reshuffleQuestions } from "@/lib/buildQuestions";
import { applyAnswer } from "@/lib/mastery";
import { QuestionCard } from "./QuestionCard";
import { OptionButton } from "./OptionButton";
import { ResultsSummary } from "./ResultsSummary";
import { StarButton } from "@/components/shared/StarButton";
import { Icon } from "@/components/ui/icons";

// Same shape used by the rest of the deck screens; QuizSession needs it so the
// results screen can show each card's post-answer mastery.
type StatsLookup = (noteId: string) =>
  | { mastery?: number; timesSeen?: number }
  | undefined;

export function QuizSession({
  onRetry,
  onExit,
  onEndTest,
  onOpenSettings,
  onFinish,
  getStats,
  getStarred,
  onToggleStar,
}: {
  onRetry: () => void;
  // Mid-quiz "← End quiz" — bails out before reaching the results screen.
  onExit: () => void;
  // Result-screen "End the test" — drops the user back onto the deck's
  // flashcard list once they've reviewed their score.
  onEndTest: () => void;
  // When provided, a Settings button appears during the active quiz (opens the
  // setting modal). Omitted by the saved-deck quiz, which has no live settings.
  onOpenSettings?: () => void;
  // Fired once when the quiz reaches the results screen. Used by the guest trial
  // to prompt sign-up; fires again after a retake completes.
  onFinish?: () => void;
  // Per-card mastery lookup used to compute the post-answer mastery shown on
  // the results screen. Optional so callers without a lookup (e.g. mid-rebuild)
  // still get a working quiz — answers default to mastery 0.
  getStats?: StatsLookup;
  // Star (focus) support for the current question. When both are provided, a ★
  // toggle appears in the quiz header so the learner can flag a card mid-test.
  getStarred?: (noteId: string) => boolean;
  onToggleStar?: (noteId: string, next: boolean) => void;
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
  const queryClient = useQueryClient();
  const recordGuestAnswer = useGuestMastery((s) => s.recordAnswer);

  const finished = currentIndex >= questions.length;

  // Stop any in-progress narration when the question changes or the quiz unmounts,
  // so audio never bleeds from one card (or screen) into the next.
  useEffect(() => {
    return () => cancelSpeech();
  }, [currentIndex]);

  // Fire onFinish once per completion (reset when a new/retake quiz starts).
  const finishFiredRef = useRef(false);
  useEffect(() => {
    if (finished && !finishFiredRef.current) {
      finishFiredRef.current = true;
      onFinish?.();
    } else if (!finished) {
      finishFiredRef.current = false;
    }
  }, [finished, onFinish]);

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
        onEndTest={onEndTest}
      />
    );
  }

  const question = questions[currentIndex];
  const answered = selectedAnswer !== null;
  const isLast = currentIndex === questions.length - 1;

  function handleSelect(option: string) {
    if (answered) return;
    const correct = option === question.correct;
    // Same +15/-20 curve the BE runs, so the optimistic value matches the
    // server-confirmed mastery — no flicker on the results screen.
    const prevMastery = getStats?.(question.noteId)?.mastery ?? 0;
    const newMastery = applyAnswer(prevMastery, correct);
    selectAnswer(option, newMastery);
    if (sessionId) {
      // Authed: server is the source of truth for mastery. Invalidate notes so
      // the next "set up a quiz" picks the new mastery up (and the dashboard
      // completion %, after the user navigates back).
      recordAnswer.mutate(
        { sessionId, noteId: question.noteId, correct },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notes"] });
            queryClient.invalidateQueries({ queryKey: ["decks"] });
            queryClient.invalidateQueries({ queryKey: ["deck-contents"] });
          },
        },
      );
    } else {
      // Guest trial: mastery lives client-side, applyAnswer mirrors the SQL curve.
      recordGuestAnswer(question.noteId, correct);
    }
  }

  const answeredCorrect = answered && selectedAnswer === question.correct;

  return (
    <div className="mx-auto flex min-h-[calc(100vh-9rem)] w-full max-w-3xl flex-col">
      {/* top bar: exit · progress · star/settings */}
      <div className="flex items-center gap-3 border-b border-line pb-4">
        <button
          type="button"
          onClick={onExit}
          title="End quiz"
          aria-label="End quiz"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-input border border-line bg-surface text-muted transition hover:text-ink"
        >
          <Icon name="x" size={17} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center justify-between font-mono text-xs text-muted">
            <span>Quiz</span>
            <span className="font-bold text-ink">
              {currentIndex + 1} / {questions.length}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full bg-accent transition-[width] duration-300"
              style={{ width: `${(currentIndex / questions.length) * 100}%` }}
            />
          </div>
        </div>
        {getStarred && onToggleStar && (
          <StarButton
            starred={getStarred(question.noteId)}
            size="sm"
            onToggle={(next) => onToggleStar(question.noteId, next)}
          />
        )}
        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            title="Quiz settings"
            aria-label="Quiz settings"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-input border border-line bg-surface text-base leading-none text-muted transition hover:text-ink"
          >
            ⚙
          </button>
        )}
      </div>

      {/* question, centered */}
      <div className="flex flex-1 items-center justify-center py-8">
        <QuestionCard prompt={question.prompt} />
      </div>

      {/* options (lettered A–D) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {question.options.map((option, idx) => (
          <OptionButton
            key={option}
            option={option}
            index={idx}
            answered={answered}
            isCorrect={option === question.correct}
            isSelected={option === selectedAnswer}
            onSelect={() => handleSelect(option)}
          />
        ))}
      </div>

      {/* footer: instant feedback + next */}
      <div className="mt-5 flex min-h-[52px] items-center gap-4 border-t border-line pt-4">
        {answered ? (
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-input ${
                answeredCorrect ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
              }`}
            >
              <Icon name={answeredCorrect ? "check" : "x"} size={18} />
            </span>
            <span className="min-w-0 truncate font-medium text-ink">
              {answeredCorrect ? (
                "Correct!"
              ) : (
                <>
                  Answer: <span className="text-success">{question.correct}</span>
                </>
              )}
            </span>
          </div>
        ) : (
          <span className="font-mono text-sm text-faint">Pick the closest answer</span>
        )}
        <div className="flex-1" />
        <button
          type="button"
          onClick={nextQuestion}
          disabled={!answered}
          className="focus-ring shrink-0 rounded-input bg-accent px-6 py-2.5 text-sm font-semibold text-white shadow-btn transition hover:opacity-95 disabled:opacity-40"
        >
          {isLast ? "Finish" : "Next"}
        </button>
      </div>
    </div>
  );
}
