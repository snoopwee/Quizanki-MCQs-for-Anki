"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useQuizStore } from "@/stores/quizStore";
import { useGuestMastery } from "@/stores/guestMasteryStore";
import { useRecordAnswer } from "@/hooks/useQuizSession";
import { cancelSpeech } from "@/lib/tts";
import { textDirection } from "@/lib/displayText";
import { reshuffleQuestions } from "@/lib/buildQuestions";
import { gradeWritten } from "@/lib/questionTypes";
import { RichText } from "@/components/shared/RichText";
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

  // Written-answer local state: the typed text, and (once checked) the auto-grade
  // plus whether the learner overrode it ("I was right"). Kept out of the store —
  // the answer isn't committed to the score/backend until they move to Next, so
  // an override changes the single recorded result rather than double-counting.
  const [writtenInput, setWrittenInput] = useState("");
  const [writtenResult, setWrittenResult] = useState<
    { autoCorrect: boolean; override: boolean } | null
  >(null);
  // Reset the written scratch state whenever the question changes.
  useEffect(() => {
    setWrittenInput("");
    setWrittenResult(null);
  }, [currentIndex]);

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
  const answered = isWritten ? writtenResult !== null : selectedAnswer !== null;
  const isLast = currentIndex === questions.length - 1;
  const writtenFinalCorrect = writtenResult
    ? writtenResult.autoCorrect || writtenResult.override
    : false;

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
      // Authed: server is the source of truth for mastery. Invalidate notes so
      // the next "set up a quiz" picks the new mastery up (and the dashboard
      // completion %, after the user navigates back).
      recordAnswer.mutate(
        { sessionId, noteId: question.noteId, correct: wasCorrect },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notes"] });
            queryClient.invalidateQueries({ queryKey: ["decks"] });
            queryClient.invalidateQueries({ queryKey: ["deck-contents"] });
            // Refresh the deck's Progress panel (tiles + accuracy-over-time chart)
            // once the user navigates back to it.
            queryClient.invalidateQueries({ queryKey: ["deck-stats"] });
            queryClient.invalidateQueries({ queryKey: ["deck-stats-history"] });
          },
        },
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
    commit(pick === question.truth, pick ? "True" : "False");
  }

  // Written: grade the typed answer and reveal — but don't record yet, so an
  // "I was right" override can still flip the outcome before Next commits it.
  function checkWritten() {
    if (question.kind !== "written" || writtenResult !== null) return;
    setWrittenResult({ autoCorrect: gradeWritten(writtenInput, question.correct), override: false });
  }

  // Advance. For written, this is where the (possibly overridden) result is
  // finally recorded — MCQ / True-False already recorded on selection.
  function handleNext() {
    if (isWritten && writtenResult && selectedAnswer === null) {
      commit(writtenFinalCorrect, writtenInput || "(blank)");
    }
    nextQuestion();
  }

  let answeredCorrect = false;
  if (answered) {
    if (question.kind === "written") answeredCorrect = writtenFinalCorrect;
    else if (question.kind === "truefalse")
      answeredCorrect = selectedAnswer === (question.truth ? "True" : "False");
    else answeredCorrect = selectedAnswer === question.correct;
  }

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
            className="grid h-9 w-9 shrink-0 place-items-center rounded-input border border-line bg-surface text-base leading-none text-muted transition hover:text-ink"
          >
            ⚙
          </button>
        )}
      </div>

      {/* question + options share one scrollable region: centered when they
          fit, scrolling internally when they don't — so the page itself never
          grows a scrollbar mid-quiz (topbar/footer stay pinned). */}
      <div className="nice-scroll min-h-0 flex-1 overflow-y-auto">
        <div className="flex min-h-full flex-col justify-center gap-6 py-6">
          <QuestionCard prompt={question.prompt} />

          {question.kind === "mcq" && (
            /* options (lettered A–D) */
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {question.options.map((option, idx) => (
                <OptionButton
                  key={option}
                  option={option}
                  index={idx}
                  answered={answered}
                  isCorrect={option === question.correct}
                  isSelected={option === selectedAnswer}
                  onSelect={() => handleOption(option)}
                />
              ))}
            </div>
          )}

          {question.kind === "truefalse" && (
            <TrueFalseChoice
              statement={question.statement}
              truth={question.truth}
              answered={answered}
              picked={selectedAnswer}
              onPick={handleTrueFalse}
            />
          )}

          {question.kind === "written" && (
            <WrittenAnswer
              input={writtenInput}
              onInput={setWrittenInput}
              onCheck={checkWritten}
              result={writtenResult}
              correct={question.correct}
              onToggleOverride={() =>
                setWrittenResult((r) => (r ? { ...r, override: !r.override } : r))
              }
            />
          )}
        </div>
      </div>

      {/* footer: instant feedback + next */}
      <div className="mt-5 flex min-h-[52px] shrink-0 items-center gap-4 border-t border-line pt-4">
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
                  Answer:{" "}
                  <span dir={textDirection(question.correct)} className="text-success">
                    <RichText text={question.correct} />
                  </span>
                </>
              )}
            </span>
          </div>
        ) : (
          <span className="font-mono text-sm text-faint">
            {question.kind === "written"
              ? "Type your answer"
              : question.kind === "truefalse"
                ? "True or false?"
                : "Pick the closest answer"}
          </span>
        )}
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

// True/False: the asserted statement above two verdict buttons. After answering,
// the correct verdict goes green and a wrong pick goes red (mirroring OptionButton).
function TrueFalseChoice({
  statement,
  truth,
  answered,
  picked,
  onPick,
}: {
  statement: string;
  truth: boolean;
  answered: boolean;
  picked: string | null;
  onPick: (pick: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-card border border-line-strong bg-surface-2 p-5 text-center">
        <p className="font-mono text-[11px] uppercase tracking-wide text-faint">Proposed answer</p>
        <p
          dir={textDirection(statement)}
          className="mt-2 font-display text-2xl font-semibold leading-tight break-words text-ink"
        >
          <RichText text={statement} />
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[true, false].map((val) => {
          const label = val ? "True" : "False";
          const isPicked = picked === label;
          const isRight = val === truth;
          const showCorrect = answered && isRight;
          const showWrong = answered && isPicked && !isRight;
          let cls =
            "focus-ring flex items-center justify-center gap-2 rounded-card border px-4 py-5 text-base font-semibold transition ";
          if (showCorrect) cls += "border-success bg-success/10 text-ink";
          else if (showWrong) cls += "border-danger bg-danger/10 text-ink";
          else if (answered) cls += "border-line text-faint";
          else cls += "border-line-strong bg-surface text-ink hover:border-accent hover:bg-accent-soft";
          return (
            <button key={label} type="button" disabled={answered} onClick={() => onPick(val)} className={cls}>
              <Icon name={val ? "check" : "x"} size={18} />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Written: a free-text field the learner types into, then checks. Grading is
// lenient (see gradeWritten) but imperfect, so a missed auto-grade offers an
// "I was right" override — the session records the final verdict on Next.
function WrittenAnswer({
  input,
  onInput,
  onCheck,
  result,
  correct,
  onToggleOverride,
}: {
  input: string;
  onInput: (v: string) => void;
  onCheck: () => void;
  result: { autoCorrect: boolean; override: boolean } | null;
  correct: string;
  onToggleOverride: () => void;
}) {
  const revealed = result !== null;
  return (
    <div className="space-y-3">
      <input
        autoFocus
        value={input}
        onChange={(e) => onInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !revealed) {
            e.preventDefault();
            onCheck();
          }
        }}
        disabled={revealed}
        dir={textDirection(input)}
        placeholder="Type the answer…"
        aria-label="Your answer"
        className="focus-ring w-full rounded-card border border-line-strong bg-surface px-4 py-3.5 text-lg text-ink disabled:opacity-70"
      />

      {!revealed && (
        <button
          type="button"
          onClick={onCheck}
          className="focus-ring w-full rounded-input bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-btn transition hover:opacity-95"
        >
          Check answer
        </button>
      )}

      {result && (
        <div
          className={`rounded-card border p-4 ${
            result.autoCorrect || result.override
              ? "border-success/40 bg-success/10"
              : "border-danger/40 bg-danger/10"
          }`}
        >
          <p className="font-mono text-[11px] uppercase tracking-wide text-faint">Correct answer</p>
          <p dir={textDirection(correct)} className="mt-1 font-display text-xl font-semibold break-words text-ink">
            <RichText text={correct} />
          </p>
          {!result.autoCorrect && (
            <button
              type="button"
              onClick={onToggleOverride}
              aria-pressed={result.override}
              className="mt-3 inline-flex items-center gap-1.5 rounded-input border border-line-strong bg-surface px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-accent"
            >
              <Icon name={result.override ? "check" : "pencil"} size={13} />
              {result.override ? "Counted as correct" : "I was right — count it"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
