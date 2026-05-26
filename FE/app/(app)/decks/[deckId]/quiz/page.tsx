"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useDeckContents } from "@/hooks/useDecks";
import { useStartSession } from "@/hooks/useQuizSession";
import { deckContentsToParsed } from "@/lib/deckContents";
import { reshuffleQuestions, type Question } from "@/lib/buildQuestions";
import { useQuizStore } from "@/stores/quizStore";
import { FlashcardViewer } from "@/components/deck/FlashcardViewer";
import { ApkgQuizSetup } from "@/components/deck/ApkgQuizSetup";
import { QuizSession } from "@/components/quiz/QuizSession";
import { Modal } from "@/components/shared/Modal";

type Step = "flashcards" | "setup" | "quiz";

export default function DeckPage() {
  const { deckId } = useParams<{ deckId: string }>();
  const router = useRouter();

  const contentsQuery = useDeckContents(deckId);
  const startSession = useStartSession();
  const startQuiz = useQuizStore((s) => s.startSession);

  const [step, setStep] = useState<Step>("flashcards");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const parsed = useMemo(
    () => (contentsQuery.data ? deckContentsToParsed(contentsQuery.data) : null),
    [contentsQuery.data],
  );

  // Saved-deck test: start a real backend session so answers are recorded.
  // Reshuffle first so a retake never repeats the same answer positions.
  function startTest(questions: Question[]) {
    setSettingsOpen(false);
    const shuffled = reshuffleQuestions(questions);
    startSession.mutate(
      { deckId, questionCount: shuffled.length, direction: "FRONT_TO_BACK" },
      {
        onSuccess: (session) => {
          startQuiz(shuffled, session.sessionId);
          setStep("quiz");
        },
      },
    );
  }

  const containerWidth = step === "quiz" ? "max-w-5xl" : "max-w-2xl";

  if (contentsQuery.isLoading) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="text-sm text-neutral-500">Loading deck…</p>
      </div>
    );
  }

  if (contentsQuery.isError || !parsed) {
    return (
      <div className="mx-auto max-w-2xl space-y-3">
        <p className="text-sm text-neutral-500">Deck not found.</p>
        <Link href="/dashboard" className="text-sm font-medium underline">
          Back to decks
        </Link>
      </div>
    );
  }

  return (
    <div className={`mx-auto ${containerWidth}`}>
      {step === "flashcards" && (
        <FlashcardViewer
          parsed={parsed}
          backLabel="Back to decks"
          onBack={() => router.push("/dashboard")}
          onStartTest={() => setStep("setup")}
        />
      )}

      {step === "setup" && (
        <ApkgQuizSetup
          parsed={parsed}
          backLabel="Back to flashcards"
          onBack={() => setStep("flashcards")}
          onStart={startTest}
        />
      )}

      {step === "quiz" && (
        <>
          <QuizSession
            onRetry={() => setStep("setup")}
            onExit={() => {
              setSettingsOpen(false);
              router.push("/dashboard");
            }}
            onOpenSettings={() => setSettingsOpen(true)}
          />
          {settingsOpen && (
            <Modal title="Quiz settings" onClose={() => setSettingsOpen(false)}>
              <ApkgQuizSetup
                parsed={parsed}
                showHeading={false}
                backLabel="Cancel"
                startLabel="Apply"
                onBack={() => setSettingsOpen(false)}
                onStart={startTest}
              />
            </Modal>
          )}
        </>
      )}
    </div>
  );
}
