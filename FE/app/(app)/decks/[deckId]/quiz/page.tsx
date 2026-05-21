"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useDecks } from "@/hooks/useDecks";
import { useNotes } from "@/hooks/useNotes";
import { useStartSession } from "@/hooks/useQuizSession";
import { buildQuestions, type QuizNote } from "@/lib/buildQuestions";
import { useQuizStore } from "@/stores/quizStore";
import { QuizSession } from "@/components/quiz/QuizSession";

export default function QuizPage() {
  const { deckId } = useParams<{ deckId: string }>();
  const router = useRouter();

  const decksQuery = useDecks();
  const notesQuery = useNotes(deckId, { limit: 200 });
  const startSession = useStartSession();
  const startQuiz = useQuizStore((s) => s.startSession);
  const resetQuiz = useQuizStore((s) => s.reset);

  const [started, setStarted] = useState(false);

  const deck = decksQuery.data?.find((d) => d.id === deckId);
  const notes = notesQuery.data ?? [];
  const loading = decksQuery.isLoading || notesQuery.isLoading;

  function handleStart() {
    if (!deck) return;
    const quizNotes: QuizNote[] = notes.map((n) => ({ id: n.id, fields: n.fields }));
    const questions = buildQuestions(quizNotes, quizNotes.length, {
      questionField: deck.questionField,
      answerField: deck.answerField,
      direction: "FRONT_TO_BACK",
    });
    startSession.mutate(
      { deckId, questionCount: quizNotes.length, direction: "FRONT_TO_BACK" },
      {
        onSuccess: (session) => {
          startQuiz(questions, session.sessionId);
          setStarted(true);
        },
      },
    );
  }

  function handleRetry() {
    resetQuiz();
    setStarted(false);
  }

  function handleExit() {
    resetQuiz();
    router.push("/dashboard");
  }

  return (
    <div className="mx-auto max-w-2xl">
      {loading && <p className="text-sm text-neutral-500">Loading deck…</p>}

      {!loading && !deck && (
        <div className="space-y-3">
          <p className="text-sm text-neutral-500">Deck not found.</p>
          <Link href="/dashboard" className="text-sm font-medium underline">
            Back to decks
          </Link>
        </div>
      )}

      {!loading && deck && !started && (
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-semibold">{deck.name}</h1>
            <p className="mt-1 text-sm text-neutral-500">{notes.length} cards in this deck.</p>
          </div>

          {notes.length < 4 ? (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
              Need at least 4 cards to build a quiz — this deck has {notes.length}.
            </p>
          ) : (
            <button
              type="button"
              onClick={handleStart}
              disabled={startSession.isPending}
              className="w-full rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
            >
              {startSession.isPending ? "Starting…" : "Start quiz"}
            </button>
          )}

          {startSession.isError && (
            <p className="text-sm text-red-600 dark:text-red-400">
              Could not start the session. Please try again.
            </p>
          )}
        </div>
      )}

      {started && <QuizSession onRetry={handleRetry} onExit={handleExit} />}
    </div>
  );
}
