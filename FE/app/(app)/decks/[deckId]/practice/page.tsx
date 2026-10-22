"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useDeckContents } from "@/hooks/useDecks";
import { useNotes } from "@/hooks/useNotes";
import { invalidateAfterAnswer, useRecordAnswer, useStartSession } from "@/hooks/useQuizSession";
import { deckContentsToParsed } from "@/lib/deckContents";
import { applyAnswer } from "@/lib/mastery";
import { reshuffleQuestions, type Question } from "@/lib/buildQuestions";
import { ApkgQuizSetup, type NoteStatsLookup } from "@/components/deck/ApkgQuizSetup";
import { PracticeTestSession } from "@/components/practice/PracticeTestSession";
import { ResultsSummary } from "@/components/quiz/ResultsSummary";
import { Spinner } from "@/components/ui/Spinner";
import type { PracticeScore } from "@/lib/practiceTest";
import type { AnswerRecord } from "@/stores/quizStore";

type Step =
  | { kind: "setup" }
  | { kind: "paper"; questions: Question[] }
  | { kind: "scoring" }
  | { kind: "results"; answers: AnswerRecord[]; score: number; total: number; questions: Question[] };

/**
 * Practice Test — a graded paper, as opposed to the quiz's one-card-at-a-time coaching.
 *
 * <p>Self-contained: setup → paper → results, all in this route. It deliberately does NOT use the
 * quiz store, which exists to drive a sequential session with instant feedback; sharing it would
 * mean two modes fighting over one piece of state for no gain.
 *
 * <p>The setup screen, the question renderers and the results screen are all the quiz's, unchanged.
 * What is new is only the middle: holding answers without grading them.
 */
export default function PracticeTestPage() {
  const { deckId } = useParams<{ deckId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const contentsQuery = useDeckContents(deckId);
  const notesQuery = useNotes(deckId);
  const startSession = useStartSession();
  const recordAnswer = useRecordAnswer();

  const [step, setStep] = useState<Step>({ kind: "setup" });

  const parsed = useMemo(
    () => (contentsQuery.data ? deckContentsToParsed(contentsQuery.data) : null),
    [contentsQuery.data],
  );

  const getStats: NoteStatsLookup = useMemo(() => {
    const map = new Map<string, { mastery: number; timesSeen: number; starred: boolean }>();
    for (const n of notesQuery.data ?? []) {
      const s = n.cardStats;
      map.set(n.id, {
        mastery: s?.mastery ?? 0,
        timesSeen: s?.timesSeen ?? 0,
        starred: s?.starred ?? false,
      });
    }
    return (noteId) => map.get(noteId);
  }, [notesQuery.data]);

  function start(questions: Question[]) {
    setStep({ kind: "paper", questions: reshuffleQuestions(questions) });
  }

  /**
   * Grade, then record every answer, then show the score.
   *
   * <p>Answers are posted ONE AT A TIME. A fifty-question paper submitted in parallel is fifty
   * simultaneous requests against a rate-limited free-tier backend — the quiz spreads the same
   * writes over the length of a sitting, and this mode must not be the thing that trips a limiter.
   * It costs a couple of seconds behind a spinner.
   *
   * <p>Recorded as `source: "quiz"`. The backend validates `quiz|learn`, so a distinct "practice"
   * source would need a DTO change AND a migration on the database production shares — not worth
   * it for a label. These answers are multiple-choice answers; mastery and the streak are right
   * either way.
   */
  async function submit(score: PracticeScore) {
    setStep({ kind: "scoring" });

    let sessionId: string | null = null;
    try {
      const session = await startSession.mutateAsync({
        deckId,
        questionCount: score.total,
        direction: "FRONT_TO_BACK",
      });
      sessionId = session.sessionId;
    } catch {
      // A session is for the stats chart, not for grading. Losing it must not lose the score the
      // learner just earned, so carry on and show the result.
      sessionId = null;
    }

    const records: AnswerRecord[] = [];
    for (const r of score.results) {
      const prev = getStats(r.question.noteId)?.mastery ?? 0;
      records.push({
        noteId: r.question.noteId,
        question: r.question.question,
        prompt: r.question.prompt,
        correct: r.question.correct,
        // A blank has no answer to show; the results row then simply omits the "You answered" line.
        selected: r.blank ? "" : (r.answer ?? ""),
        wasCorrect: r.correct,
        newMastery: applyAnswer(prev, r.correct),
      });
      if (sessionId) {
        try {
          await recordAnswer.mutateAsync({
            sessionId,
            noteId: r.question.noteId,
            correct: r.correct,
            source: "quiz",
          });
        } catch {
          // One failed write should not abandon the other forty-nine, nor hide the score.
        }
      }
    }
    invalidateAfterAnswer(queryClient);

    setStep({
      kind: "results",
      answers: records,
      score: score.correct,
      total: score.total,
      questions: score.results.map((r) => r.question),
    });
  }

  const backToDeck = () => router.push(`/decks/${deckId}`);

  if (step.kind === "paper") {
    return (
      <div className="mx-auto max-w-5xl p-6 md:p-8">
        <PracticeTestSession
          questions={step.questions}
          onSubmit={submit}
          onExit={() => setStep({ kind: "setup" })}
        />
      </div>
    );
  }

  if (step.kind === "scoring") {
    return (
      <div className="mx-auto flex max-w-2xl items-center gap-3 p-6 text-sm text-muted">
        <Spinner className="h-4 w-4" /> Marking your paper…
      </div>
    );
  }

  if (step.kind === "results") {
    return (
      <div className="mx-auto max-w-5xl p-6 md:p-8">
        <ResultsSummary
          answers={step.answers}
          score={step.score}
          total={step.total}
          // Same paper again, freshly shuffled.
          onRetakeSame={() => start(step.questions)}
          // Only the ones that went wrong — the most useful second pass.
          onRetakeWrong={() => {
            const missed = new Set(
              step.answers.filter((a) => !a.wasCorrect).map((a) => a.noteId),
            );
            const subset = step.questions.filter((q) => missed.has(q.noteId));
            if (subset.length > 0) start(subset);
          }}
          onRetakeNew={() => setStep({ kind: "setup" })}
          newLabel="New test"
          onEndTest={backToDeck}
        />
      </div>
    );
  }

  if (contentsQuery.isLoading || !parsed) {
    return (
      <div className="mx-auto flex max-w-2xl items-center gap-3 p-6 text-sm text-muted">
        <Spinner className="h-4 w-4" /> Loading deck…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-6 md:p-8">
      <div className="mb-5">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Set up a practice test</h1>
        <p className="mt-1 text-sm text-muted">
          Answer the whole paper, then submit it to be scored. No feedback until you do — you can
          move between questions and change your answers freely.
        </p>
      </div>
      <ApkgQuizSetup
        parsed={parsed}
        getStats={getStats}
        deckId={deckId}
        showHeading={false}
        backLabel="Back to deck"
        startLabel="Start test"
        onBack={backToDeck}
        onStart={start}
      />
    </div>
  );
}
