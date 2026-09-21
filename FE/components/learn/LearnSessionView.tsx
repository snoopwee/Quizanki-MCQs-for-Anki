"use client";

import { useEffect, useRef, useState } from "react";
import { useWrittenAnswer } from "@/hooks/useWrittenAnswer";
import { cancelSpeech, speak } from "@/lib/tts";
import { textDirection } from "@/lib/displayText";
import { gradeWritten } from "@/lib/questionTypes";
import { isAnswerCorrect, trueFalseLabel } from "@/lib/questionAnswer";
import {
  answerLearnCard,
  learnProgress,
  startLearnSession,
  type LearnSession,
} from "@/lib/learnSession";
import type { CardTemplate } from "@/lib/buildQuestions";
import type { LearnPreferences } from "@/lib/learnPreferences";
import { QUESTION_SPEECH_ID, QuestionCard, promptSpeechText } from "@/components/quiz/QuestionCard";
import { QuestionBody } from "@/components/quiz/questions/QuestionBody";
import { AnswerFeedback } from "@/components/quiz/questions/AnswerFeedback";
import { StarButton } from "@/components/shared/StarButton";
import { IconButton, iconButtonIconSize } from "@/components/ui/IconButton";
import { Icon } from "@/components/ui/icons";

// One Learn session on screen: the question, instant feedback, and Next. Uses the quiz's
// question renderers; the session engine (lib/learnSession) decides what comes up next.
// The page remounts this per session (keyed), so `templates` / `prefs` are read once.
export function LearnSessionView({
  templates,
  prefs,
  resumeFrom,
  paused,
  onAnswer,
  onProgress,
  onComplete,
  onExit,
  onOpenSettings,
  getStarred,
  onToggleStar,
}: {
  templates: CardTemplate[];
  prefs: LearnPreferences;
  // A saved session to pick up instead of dealing a new one.
  resumeFrom?: LearnSession;
  // True while a modal is open — keyboard shortcuts stand down.
  paused: boolean;
  // Every answer, as it's final. The page records it (mastery + streak).
  onAnswer: (noteId: string, correct: boolean) => void;
  // The session after every change, plus a multiple choice / true-false verdict already
  // recorded before Next (null when none) — the page saves both so leaving can resume.
  onProgress?: (session: LearnSession, pending: boolean | null) => void;
  onComplete: (session: LearnSession) => void;
  onExit: () => void;
  onOpenSettings: () => void;
  getStarred?: (noteId: string) => boolean;
  onToggleStar?: (noteId: string, next: boolean) => void;
}) {
  const [session, setSession] = useState<LearnSession>(
    () =>
      resumeFrom ??
      startLearnSession(templates, prefs.kinds, { shuffle: prefs.shuffle, retryMissed: prefs.retryMissed }),
  );
  // The recorded pick for multiple choice / true-false on the current ask.
  const [picked, setPicked] = useState<string | null>(null);
  // Re-typing the right answer after a wrong written one (when that setting is on).
  const [retype, setRetype] = useState("");
  const written = useWrittenAnswer(session.asked);
  const question = session.current;

  // Report completion once.
  const completedRef = useRef(false);
  useEffect(() => {
    if (session.current === null && !completedRef.current) {
      completedRef.current = true;
      onComplete(session);
    }
  }, [session, onComplete]);

  // Report every change (the first render included) so the page can save it.
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;
  useEffect(() => {
    onProgressRef.current?.(session, null);
  }, [session]);

  // Stop narration when the question changes or the session unmounts.
  useEffect(() => {
    return () => cancelSpeech();
  }, [session.asked]);

  const speechText = question ? promptSpeechText(question.prompt) : "";
  useEffect(() => {
    if (prefs.readAloud && speechText) speak(QUESTION_SPEECH_ID, speechText);
  }, [prefs.readAloud, session.asked, speechText]);

  const isWritten = question?.kind === "written";
  const answered = question ? (isWritten ? written.result !== null : picked !== null) : false;
  const correct = question !== null && answered && isAnswerCorrect(question, picked, written.result);
  const needsRetype = question !== null && prefs.retypeWrong && isWritten && answered && !correct;
  const retyped =
    needsRetype && gradeWritten(retype, question.correct, { typoTolerant: prefs.smartGrading });
  const canAdvance = answered && (!needsRetype || retyped);
  // The last card, and this answer won't send it back.
  const finishing = answered && (correct || !prefs.retryMissed) && session.queue.length === 1;

  // Guards against a double Next (click + Enter) advancing past the same answer twice.
  const advancedAtRef = useRef(-1);
  function handleNext() {
    if (!question || !canAdvance || advancedAtRef.current === session.asked) return;
    advancedAtRef.current = session.asked;
    // Written answers are final only now (an "I was right" override can still flip them);
    // multiple choice and true/false were recorded on the pick.
    if (question.kind === "written") onAnswer(question.noteId, correct);
    // Clear every answer state in the same update as the advance, so the next question
    // never renders with this one's pick or result.
    setPicked(null);
    setRetype("");
    written.reset();
    setSession((s) => answerLearnCard(s, correct));
  }

  // Enter moves on once the answer is in. Inputs handle their own Enter (check / re-type),
  // and a focused button already clicks on Enter.
  const nextRef = useRef(handleNext);
  nextRef.current = handleNext;
  useEffect(() => {
    if (paused) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Enter" || e.repeat || e.defaultPrevented) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON") return;
      nextRef.current();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [paused]);

  if (!question) return null;

  const { done, total } = learnProgress(session);

  function handleOption(option: string) {
    if (answered || !question) return;
    setPicked(option);
    const right = option === question.correct;
    onAnswer(question.noteId, right);
    onProgressRef.current?.(session, right);
  }

  function handleTrueFalse(pick: boolean) {
    if (answered || !question || question.kind !== "truefalse") return;
    setPicked(trueFalseLabel(pick));
    const right = pick === question.truth;
    onAnswer(question.noteId, right);
    onProgressRef.current?.(session, right);
  }

  function checkWritten() {
    if (!question || question.kind !== "written") return;
    written.check(question.correct, { typoTolerant: prefs.smartGrading });
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-10rem)] w-full max-w-3xl flex-col">
      {/* top bar: exit · progress · star / settings */}
      <div className="flex shrink-0 items-center gap-3 border-b border-line pb-4">
        <IconButton label="End session" size="sm" onClick={onExit} className="text-muted hover:text-ink">
          <Icon name="x" size={iconButtonIconSize("sm")} />
        </IconButton>
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center justify-between font-mono text-xs text-muted">
            <span>{resumeFrom ? "Learn · resumed" : "Learn"}</span>
            <span>
              <span className="font-bold text-ink">
                {done} / {total}
              </span>{" "}
              {prefs.retryMissed ? "learned" : "done"}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full bg-accent transition-[width] duration-300"
              style={{ width: `${(done / total) * 100}%` }}
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
        <IconButton label="Learn settings" size="sm" onClick={onOpenSettings} className="text-muted hover:text-ink">
          <Icon name="settings" size={iconButtonIconSize("sm")} />
        </IconButton>
      </div>

      {/* question + answers share one scrollable region, like the quiz */}
      <div className="nice-scroll min-h-0 flex-1 overflow-y-auto">
        <div className="flex min-h-full flex-col justify-center gap-6 py-6">
          <QuestionCard prompt={question.prompt} />
          {/* Keyed per ask so a card that comes back starts fresh (and the written field
              focuses again). */}
          <QuestionBody
            key={session.asked}
            question={question}
            answered={answered}
            selected={picked}
            onPickOption={handleOption}
            onPickTrueFalse={handleTrueFalse}
            writtenInput={written.input}
            onWrittenInput={written.setInput}
            writtenResult={written.result}
            onCheckWritten={checkWritten}
            onToggleOverride={written.toggleOverride}
          />
          {needsRetype && (
            <RetypeAnswer value={retype} onChange={setRetype} matched={retyped} onSubmit={handleNext} />
          )}
        </div>
      </div>

      {/* footer: instant feedback + next */}
      <div className="mt-5 flex min-h-[3.25rem] shrink-0 items-center gap-4 border-t border-line pt-4">
        <AnswerFeedback question={question} answered={answered} isCorrect={correct} />
        <div className="flex-1" />
        <button
          type="button"
          onClick={handleNext}
          disabled={!canAdvance}
          className="focus-ring shrink-0 rounded-input bg-accent px-6 py-2.5 text-sm font-semibold text-white shadow-btn transition hover:opacity-95 disabled:opacity-40"
        >
          {finishing ? "Finish" : "Next"}
        </button>
      </div>
    </div>
  );
}

// After a wrong written answer (with "Re-type wrong written answers" on): type the correct
// answer to continue. Graded like the answer itself, smart grading included.
function RetypeAnswer({
  value,
  onChange,
  matched,
  onSubmit,
}: {
  value: string;
  onChange: (value: string) => void;
  matched: boolean;
  onSubmit: () => void;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor="learn-retype" className="block text-sm font-semibold text-ink">
        Type the correct answer to continue
      </label>
      <input
        id="learn-retype"
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onSubmit();
          }
        }}
        dir={textDirection(value)}
        placeholder="Type the answer shown above…"
        className={`focus-ring w-full rounded-card border bg-surface px-4 py-3.5 text-lg text-ink ${
          matched ? "border-success" : "border-line-strong"
        }`}
      />
    </div>
  );
}
