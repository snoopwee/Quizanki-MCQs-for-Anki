"use client";

import { useState } from "react";
import Link from "next/link";
import { ApkgUploader } from "@/components/deck/ApkgUploader";
import { FlashcardViewer } from "@/components/deck/FlashcardViewer";
import { ApkgQuizSetup } from "@/components/deck/ApkgQuizSetup";
import { DeckImporter } from "@/components/deck/DeckImporter";
import { FieldDetector } from "@/components/deck/FieldDetector";
import { QuizSession } from "@/components/quiz/QuizSession";
import { Modal } from "@/components/shared/Modal";
import type { ParseResult } from "@/lib/parseDeck";
import { reshuffleQuestions, type Question } from "@/lib/buildQuestions";
import { parsedToImportRequest } from "@/lib/parsedToImportRequest";
import { useImportDeck } from "@/hooks/useDecks";
import { useQuizStore } from "@/stores/quizStore";
import type { ApkgParseResponse, DeckResponse } from "@/types/api";

type Step =
  | { kind: "import" }
  | { kind: "detect"; result: ParseResult }
  | { kind: "flashcards"; parsed: ApkgParseResponse }
  | { kind: "apkg-setup"; parsed: ApkgParseResponse }
  | { kind: "apkg-quiz"; parsed: ApkgParseResponse; questions: Question[] }
  | { kind: "done"; deck: DeckResponse };

export default function ImportPage() {
  const [step, setStep] = useState<Step>({ kind: "import" });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const startSession = useQuizStore((s) => s.startSession);
  const importDeck = useImportDeck();

  // /import is logged-in only, so a successfully parsed .apkg is auto-saved to the
  // user's decks. The flashcard/test flow continues regardless of the save result.
  function handleParsed(parsed: ApkgParseResponse) {
    setStep({ kind: "flashcards", parsed });
    importDeck.mutate(parsedToImportRequest(parsed));
  }

  // Trial/preview quiz on this page uses an empty sessionId so QuizSession doesn't
  // record answers; the saved deck is studied/tested from the dashboard instead.
  function startTrial(parsed: ApkgParseResponse, questions: Question[]) {
    setSettingsOpen(false);
    // Reshuffle so a retake/new-test never repeats the same answer positions.
    const shuffled = reshuffleQuestions(questions);
    startSession(shuffled, "");
    setStep({ kind: "apkg-quiz", parsed, questions: shuffled });
  }

  // The quiz screen uses a wide two-column layout; other steps stay narrow.
  const containerWidth = step.kind === "apkg-quiz" ? "max-w-7xl" : "max-w-2xl";

  return (
    <div className={`mx-auto ${containerWidth}`}>
      {step.kind === "import" && (
        <div className="space-y-8">
          <ApkgUploader onContinue={handleParsed} />
          <div className="border-t border-neutral-200 pt-8 dark:border-neutral-800">
            <DeckImporter onContinue={(result) => setStep({ kind: "detect", result })} />
          </div>
        </div>
      )}

      {step.kind === "detect" && (
        <FieldDetector
          result={step.result}
          onBack={() => setStep({ kind: "import" })}
          onImported={(deck) => setStep({ kind: "done", deck })}
        />
      )}

      {step.kind === "flashcards" && (
        <div className="space-y-4">
          <SaveStatus
            state={importDeck.status}
            onRetry={() => importDeck.mutate(parsedToImportRequest(step.parsed))}
          />
          <FlashcardViewer
            parsed={step.parsed}
            onBack={() => setStep({ kind: "import" })}
            onStartTest={() => setStep({ kind: "apkg-setup", parsed: step.parsed })}
          />
        </div>
      )}

      {step.kind === "apkg-setup" && (
        <div className="space-y-4">
          <SaveStatus
            state={importDeck.status}
            onRetry={() => importDeck.mutate(parsedToImportRequest(step.parsed))}
          />
          <ApkgQuizSetup
            parsed={step.parsed}
            onBack={() => setStep({ kind: "flashcards", parsed: step.parsed })}
            onStart={(questions) => startTrial(step.parsed, questions)}
          />
        </div>
      )}

      {step.kind === "apkg-quiz" && (
        <>
          <QuizSession
            onRetry={() => startTrial(step.parsed, step.questions)}
            onExit={() => {
              setSettingsOpen(false);
              setStep({ kind: "apkg-setup", parsed: step.parsed });
            }}
            onOpenSettings={() => setSettingsOpen(true)}
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
        </>
      )}

      {step.kind === "done" && (
        <div className="space-y-4">
          <h1 className="text-2xl font-semibold">Deck imported</h1>
          <p className="text-sm text-neutral-500">
            <span className="font-medium text-neutral-900 dark:text-neutral-100">
              {step.deck.name}
            </span>{" "}
            saved with {step.deck.cardCount ?? 0} cards.
          </p>
          <div className="flex gap-3">
            <Link
              href="/dashboard"
              className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
            >
              Go to dashboard
            </Link>
            <button
              type="button"
              onClick={() => setStep({ kind: "import" })}
              className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
            >
              Import another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Small banner reflecting the auto-save of the imported deck.
function SaveStatus({
  state,
  onRetry,
}: {
  state: "idle" | "pending" | "success" | "error";
  onRetry: () => void;
}) {
  if (state === "pending") {
    return (
      <p className="rounded-md bg-neutral-100 px-3 py-2 text-sm text-neutral-600 dark:bg-neutral-900 dark:text-neutral-300">
        Saving deck to your account…
      </p>
    );
  }
  if (state === "success") {
    return (
      <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-900/30 dark:text-green-300">
        ✓ Saved to your decks
      </p>
    );
  }
  if (state === "error") {
    return (
      <p className="flex items-center justify-between gap-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-300">
        <span>Couldn&apos;t save this deck to your account.</span>
        <button type="button" onClick={onRetry} className="font-medium underline">
          Retry
        </button>
      </p>
    );
  }
  return null;
}
