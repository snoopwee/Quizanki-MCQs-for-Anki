"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApkgUploader } from "@/components/deck/ApkgUploader";
import { FlashcardViewer } from "@/components/deck/FlashcardViewer";
import { ApkgQuizSetup } from "@/components/deck/ApkgQuizSetup";
import { QuizSession } from "@/components/quiz/QuizSession";
import { Modal } from "@/components/shared/Modal";
import { AuthModal } from "@/components/auth/AuthModal";
import { reshuffleQuestions, type Question } from "@/lib/buildQuestions";
import { parsedToImportRequest } from "@/lib/parsedToImportRequest";
import { useImportDeck } from "@/hooks/useDecks";
import { useQuizStore } from "@/stores/quizStore";
import type { ApkgParseResponse } from "@/types/api";

// Public, no-auth trial flow: upload → study flashcards → set up → take a quiz.
// Nothing is saved (guests have no account). Chunk 5 adds a post-trial prompt to
// log in / sign up, which saves the just-imported deck to the new account.
type Step =
  | { kind: "import" }
  | { kind: "flashcards"; parsed: ApkgParseResponse }
  | { kind: "setup"; parsed: ApkgParseResponse }
  | { kind: "quiz"; parsed: ApkgParseResponse; questions: Question[] };

export default function TryPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ kind: "import" });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const startSession = useQuizStore((s) => s.startSession);
  const importDeck = useImportDeck();

  // Trial quiz: empty sessionId so QuizSession never records answers.
  function startTrial(parsed: ApkgParseResponse, questions: Question[]) {
    setSettingsOpen(false);
    const shuffled = reshuffleQuestions(questions);
    startSession(shuffled, "");
    setStep({ kind: "quiz", parsed, questions: shuffled });
  }

  const containerWidth = step.kind === "quiz" ? "max-w-7xl" : "max-w-2xl";

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-neutral-200 px-6 py-3 dark:border-neutral-800">
        <Link href="/" className="font-semibold">
          AnkiQuiz
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden text-neutral-500 sm:inline">Trying without an account</span>
          <Link
            href="/auth/login"
            className="rounded-md border border-neutral-300 px-3 py-1.5 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            Log in
          </Link>
          <Link
            href="/auth/signup"
            className="rounded-md bg-black px-3 py-1.5 font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
          >
            Sign up
          </Link>
        </div>
      </header>

      <main className="p-6">
        <div className={`mx-auto ${containerWidth}`}>
          {step.kind === "import" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-semibold">Try AnkiQuiz</h1>
                <p className="mt-1 text-sm text-neutral-500">
                  Upload an Anki deck and take a quiz — no account needed. Sign up later to save your
                  decks and track progress.
                </p>
              </div>
              <ApkgUploader
                onContinue={(parsed) => setStep({ kind: "flashcards", parsed })}
              />
            </div>
          )}

          {step.kind === "flashcards" && (
            <FlashcardViewer
              parsed={step.parsed}
              backLabel="Start over"
              onBack={() => setStep({ kind: "import" })}
              onStartTest={() => setStep({ kind: "setup", parsed: step.parsed })}
            />
          )}

          {step.kind === "setup" && (
            <ApkgQuizSetup
              parsed={step.parsed}
              backLabel="Back to flashcards"
              onBack={() => setStep({ kind: "flashcards", parsed: step.parsed })}
              onStart={(questions) => startTrial(step.parsed, questions)}
            />
          )}

          {step.kind === "quiz" && (
            <>
              <QuizSession
                onRetry={() => startTrial(step.parsed, step.questions)}
                onExit={() => {
                  setSettingsOpen(false);
                  setStep({ kind: "setup", parsed: step.parsed });
                }}
                onOpenSettings={() => setSettingsOpen(true)}
                onFinish={() => setSaveOpen(true)}
              />
              {settingsOpen && (
                <Modal title="Quiz settings" onClose={() => setSettingsOpen(false)}>
                  <ApkgQuizSetup
                    parsed={step.parsed}
                    showHeading={false}
                    backLabel="Cancel"
                    startLabel="Apply"
                    onBack={() => setSettingsOpen(false)}
                    onStart={(questions) => startTrial(step.parsed, questions)}
                  />
                </Modal>
              )}
              {saveOpen && (
                <AuthModal
                  title="Save your deck"
                  description="Nice work! Create an account (or log in) to save this deck to your library and keep studying."
                  onClose={() => setSaveOpen(false)}
                  onAuthed={async () => {
                    // Now authenticated — the axios interceptor attaches the new
                    // token, so this save lands in the just-created account.
                    const deck = await importDeck.mutateAsync(parsedToImportRequest(step.parsed));
                    router.push(`/decks/${deck.id}/quiz`);
                    router.refresh();
                  }}
                />
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
