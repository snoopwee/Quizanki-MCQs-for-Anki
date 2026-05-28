"use client";

import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useQuizStore } from "@/stores/quizStore";
import { useGuestMastery } from "@/stores/guestMasteryStore";
import { useRecordAnswer } from "@/hooks/useQuizSession";
import { reshuffleQuestions } from "@/lib/buildQuestions";
import { applyAnswer } from "@/lib/mastery";
import { ProgressBar } from "./ProgressBar";
import { QuestionCard } from "./QuestionCard";
import { OptionButton } from "./OptionButton";
import { ResultsSummary } from "./ResultsSummary";

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
  inputDisabled = false,
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
  // Suspends the keyboard shortcuts. Callers pass true while a modal (settings,
  // save, etc.) is open so 1-4 / Enter don't leak through to the quiz behind it.
  inputDisabled?: boolean;
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

  // Pre-compute these unconditionally so the hooks below see consistent values;
  // when finished, `question` is undefined and the hooks guard accordingly.
  const question = questions[currentIndex];
  const answered = selectedAnswer !== null;
  const isLast = currentIndex === questions.length - 1;

  const handleSelect = useCallback(
    (option: string) => {
      if (answered || !question) return;
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
    },
    [
      answered,
      question,
      getStats,
      selectAnswer,
      sessionId,
      recordAnswer,
      queryClient,
      recordGuestAnswer,
    ],
  );

  // 1-4 selects the matching option (when not yet answered); Enter/Space
  // advances (when answered). Skips when focus is in a form control or when
  // the parent has suspended input (modal open). Listener is rebound when any
  // of the captured pieces change — cheap, and avoids stale closures over
  // `question` / `answered` / handlers.
  useEffect(() => {
    if (finished || inputDisabled || !question) return;
    function onKey(e: KeyboardEvent) {
      if (e.repeat || e.defaultPrevented) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        if (target.isContentEditable) return;
      }

      const digit = "1234".indexOf(e.key);
      if (digit !== -1 && !answered && digit < question.options.length) {
        e.preventDefault();
        handleSelect(question.options[digit]);
        return;
      }
      if ((e.key === "Enter" || e.key === " ") && answered) {
        e.preventDefault();
        nextQuestion();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [finished, inputDisabled, answered, question, nextQuestion, handleSelect]);

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
            {question.options.map((option, i) => (
              <OptionButton
                key={option}
                option={option}
                index={i}
                answered={answered}
                isCorrect={option === question.correct}
                isSelected={option === selectedAnswer}
                onSelect={() => handleSelect(option)}
              />
            ))}
          </div>

          <div className="space-y-1">
            <button
              type="button"
              onClick={nextQuestion}
              disabled={!answered}
              className="w-full rounded-md bg-black px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-40 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
            >
              {isLast ? "See results" : "Next question"}
            </button>
            <p className="text-center text-[11px] text-neutral-400">
              Keys: <kbd className="rounded border border-neutral-300 px-1 dark:border-neutral-700">1</kbd>–
              <kbd className="rounded border border-neutral-300 px-1 dark:border-neutral-700">4</kbd> to
              answer · <kbd className="rounded border border-neutral-300 px-1 dark:border-neutral-700">Enter</kbd>{" "}
              for next
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
