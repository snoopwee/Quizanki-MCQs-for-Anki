"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useDeckContents } from "@/hooks/useDecks";
import { useNotes, useToggleStar } from "@/hooks/useNotes";
import { deckContentsToParsed } from "@/lib/deckContents";
import { useQuizStore } from "@/stores/quizStore";
import { ApkgQuizSetup, type NoteStatsLookup } from "@/components/deck/ApkgQuizSetup";
import { QuizSession } from "@/components/quiz/QuizSession";
import { Modal } from "@/components/shared/Modal";
import { useStartSession } from "@/hooks/useQuizSession";
import { reshuffleQuestions, type Question } from "@/lib/buildQuestions";

// The test screen takes over the full layout (sidebar is hidden by AppShell
// for any URL ending in /test). It reads the questions the detail page put in
// the quiz store; if there are none (e.g. someone navigated here directly), it
// bounces back to the deck detail so the user can pick their settings first.
export default function DeckTestPage() {
  const { deckId } = useParams<{ deckId: string }>();
  const router = useRouter();
  const questions = useQuizStore((s) => s.questions);
  const startQuiz = useQuizStore((s) => s.startSession);
  const startSession = useStartSession();

  const contentsQuery = useDeckContents(deckId);
  const notesQuery = useNotes(deckId);
  const toggleStar = useToggleStar(deckId);

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

  const getStarred = (id: string) => getStats(id)?.starred ?? false;
  const onToggleStar = (id: string, next: boolean) =>
    toggleStar.mutate({ noteId: id, starred: next });

  const [settingsOpen, setSettingsOpen] = useState(false);

  // No questions in the store = direct navigation / refresh. Bounce back to
  // setup so the user can configure a quiz and start it properly.
  useEffect(() => {
    if (questions.length === 0) {
      router.replace(`/decks/${deckId}?step=setup`);
    }
  }, [questions.length, deckId, router]);

  function exitToSetup() {
    setSettingsOpen(false);
    router.push(`/decks/${deckId}?step=setup`);
  }

  // Result-screen "End the test" goes to the deck's flashcard list rather than
  // straight back to setup, so the learner can see their updated mastery badges
  // before deciding what to do next.
  function endTest() {
    setSettingsOpen(false);
    router.push(`/decks/${deckId}`);
  }

  function applySettings(next: Question[]) {
    setSettingsOpen(false);
    if (!parsed) return;
    const shuffled = reshuffleQuestions(next);
    startSession.mutate(
      { deckId, questionCount: shuffled.length, direction: "FRONT_TO_BACK" },
      {
        onSuccess: (session) => {
          startQuiz(shuffled, session.sessionId);
        },
      },
    );
  }

  if (questions.length === 0) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <p className="text-sm text-neutral-500">Loading test…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-6 md:p-8">
      <QuizSession
        onRetry={exitToSetup}
        onExit={exitToSetup}
        onEndTest={endTest}
        onOpenSettings={() => setSettingsOpen(true)}
        getStats={getStats}
        getStarred={getStarred}
        onToggleStar={onToggleStar}
      />
      {settingsOpen && parsed && (
        <Modal title="Quiz settings" onClose={() => setSettingsOpen(false)}>
          <ApkgQuizSetup
            parsed={parsed}
            getStats={getStats}
            deckId={deckId}
            showHeading={false}
            backLabel="Cancel"
            startLabel="Apply"
            onBack={() => setSettingsOpen(false)}
            onStart={applySettings}
          />
        </Modal>
      )}
    </div>
  );
}
