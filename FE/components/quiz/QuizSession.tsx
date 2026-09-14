"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useQuizStore } from "@/stores/quizStore";
import { useGuestMastery } from "@/stores/guestMasteryStore";
import { invalidateAfterAnswer, useRecordAnswer } from "@/hooks/useQuizSession";
import { useWrittenAnswer } from "@/hooks/useWrittenAnswer";
import { cancelSpeech } from "@/lib/tts";
import { reshuffleQuestions } from "@/lib/buildQuestions";
import { isAnswerCorrect, trueFalseLabel, writtenIsCorrect } from "@/lib/questionAnswer";
import { applyAnswer } from "@/lib/mastery";
import { QuestionCard } from "./QuestionCard";
import { QuestionBody } from "./questions/QuestionBody";
import { AnswerFeedback } from "./questions/AnswerFeedback";
import { ResultsSummary } from "./ResultsSummary";
import { StarButton } from "@/components/shared/StarButton";
import { Icon } from "@/components/ui/icons";

// Same shape used by the rest of the deck screens; QuizSession needs it so the
// results screen can show each card's post-answer mastery.
type StatsLookup = (noteId: string) =>
  | { mastery?: number; timesSeen?: number }
  | undefined;

// The quiz: one question at a time from the quiz store, answered with the shared question
// renderers (`./questions/`), then the results screen. Owns the quiz-only parts — recording
// answers (backend for a signed-in session, client-side for the guest trial), retakes, and
// the top bar.
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

  // Written-answer scratch state (typed text, auto-grade, "I was right" override), reset
  // whenever the question changes. Not committed until Next — see useWrittenAnswer.
  const written = useWrittenAnswer(currentIndex);

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
  const isWritten = question.kind === "written";
  // Written locks once checked; MCQ / True-False lock once an answer is recorded.
  const answered = isWritten ? written.result !== null : selectedAnswer !== null;
  const isLast = currentIndex === questions.length - 1;

  // Records one answer (score + AnswerRecord + backend/guest mastery). Correctness
  // is graded per kind by the caller; the recording plumbing is identical.
  function commit(wasCorrect: boolean, selectedDisplay: string) {
    if (selectedAnswer !== null) return;
    // Same +15/-20 curve the BE runs, so the optimistic value matches the
    // server-confirmed mastery — no flicker on the results screen.
    const prevMastery = getStats?.(question.noteId)?.mastery ?? 0;
    const newMastery = applyAnswer(prevMastery, wasCorrect);
    selectAnswer(selectedDisplay, wasCorrect, newMastery);
    if (sessionId) {
      // Authed: server is the source of truth for mastery.
      recordAnswer.mutate(
        { sessionId, noteId: question.noteId, correct: wasCorrect, source: "quiz" },
        { onSuccess: () => invalidateAfterAnswer(queryClient) },
      );
    } else {
      // Guest trial: mastery lives client-side, applyAnswer mirrors the SQL curve.
      recordGuestAnswer(question.noteId, wasCorrect);
    }
  }

  // MCQ: an option was tapped. Instant feedback, records immediately.
  function handleOption(option: string) {
    if (answered) return;
    commit(option === question.correct, option);
  }

  // True/False: the learner judged the asserted statement.
  function handleTrueFalse(pick: boolean) {
    if (answered || question.kind !== "truefalse") return;
    commit(pick === question.truth, trueFalseLabel(pick));
  }

  // Written: grade the typed answer and reveal — but don't record yet, so an
  // "I was right" override can still flip the outcome before Next commits it.
  function checkWritten() {
    if (question.kind !== "written") return;
    written.check(question.correct);
  }

  // Advance. For written, this is where the (possibly overridden) result is
  // finally recorded — MCQ / True-False already recorded on selection.
  function handleNext() {
    if (isWritten && written.result && selectedAnswer === null) {
      commit(writtenIsCorrect(written.result), written.input || "(blank)");
    }
    nextQuestion();
  }

  const answeredCorrect = answered && isAnswerCorrect(question, selectedAnswer, written.result);

  return (
    <div className="mx-auto flex h-[calc(100dvh-10rem)] w-full max-w-3xl flex-col">
      {/* top bar: exit · progress · star/settings */}
      <div className="flex shrink-0 items-center gap-3 border-b border-line pb-4">
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
            className="grid h-9 w-9 shrink-0 place-items-center rounded-input border border-line bg-surface leading-none text-muted transition hover:text-ink"
          >
            <Icon name="settings" size={17} />
          </button>
        )}
      </div>

      {/* question + options share one scrollable region: centered when they
          fit, scrolling internally when they don't — so the page itself never
          grows a scrollbar mid-quiz (topbar/footer stay pinned). */}
      <div className="nice-scroll min-h-0 flex-1 overflow-y-auto">
        <div className="flex min-h-full flex-col justify-center gap-6 py-6">
          <QuestionCard prompt={question.prompt} />
          <QuestionBody
            question={question}
            answered={answered}
            selected={selectedAnswer}
            onPickOption={handleOption}
            onPickTrueFalse={handleTrueFalse}
            writtenInput={written.input}
            onWrittenInput={written.setInput}
            writtenResult={written.result}
            onCheckWritten={checkWritten}
            onToggleOverride={written.toggleOverride}
          />
        </div>
      </div>

      {/* footer: instant feedback + next */}
      <div className="mt-5 flex min-h-[3.25rem] shrink-0 items-center gap-4 border-t border-line pt-4">
        <AnswerFeedback question={question} answered={answered} isCorrect={answeredCorrect} />
        <div className="flex-1" />
        <button
          type="button"
          onClick={handleNext}
          disabled={!answered}
          className="focus-ring shrink-0 rounded-input bg-accent px-6 py-2.5 text-sm font-semibold text-white shadow-btn transition hover:opacity-95 disabled:opacity-40"
        >
          {isLast ? "Finish" : "Next"}
        </button>
      </div>
    </div>
  );
}
