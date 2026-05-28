"use client";

import { useEffect, useState } from "react";
import { ApkgUploader } from "@/components/deck/ApkgUploader";
import { FlashcardViewer } from "@/components/deck/FlashcardViewer";
import { ApkgQuizSetup } from "@/components/deck/ApkgQuizSetup";
import { QuizSession } from "@/components/quiz/QuizSession";
import { Modal } from "@/components/shared/Modal";
import { Toast } from "@/components/shared/Toast";
import { reshuffleQuestions, type Question } from "@/lib/buildQuestions";
import { parsedToImportRequest } from "@/lib/parsedToImportRequest";
import { useImportDeck } from "@/hooks/useDecks";
import { useQuizStore } from "@/stores/quizStore";
import type { ApkgParseResponse } from "@/types/api";

type Step =
  | { kind: "import" }
  | { kind: "flashcards"; parsed: ApkgParseResponse }
  | { kind: "apkg-setup"; parsed: ApkgParseResponse }
  | { kind: "apkg-quiz"; parsed: ApkgParseResponse; questions: Question[] };

export default function ImportPage() {
  const [step, setStep] = useState<Step>({ kind: "import" });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toastDismissed, setToastDismissed] = useState(false);
  const startSession = useQuizStore((s) => s.startSession);
  const importDeck = useImportDeck();

  // /import is logged-in only, so a successfully parsed .apkg is auto-saved to the
  // user's decks. The flashcard/test flow continues regardless of the save result.
  function handleParsed(parsed: ApkgParseResponse) {
    setStep({ kind: "flashcards", parsed });
    setToastDismissed(false);
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

  // Reset the toast-dismiss latch whenever a new save kicks off so the next
  // status (success/error) gets its own toast instead of staying hidden.
  useEffect(() => {
    if (importDeck.status === "pending") setToastDismissed(false);
  }, [importDeck.status]);

  // The quiz screen uses a wide two-column layout; other steps stay narrow.
  const containerWidth = step.kind === "apkg-quiz" ? "max-w-7xl" : "max-w-2xl";

  function retrySave() {
    if (step.kind === "import") return;
    setToastDismissed(false);
    importDeck.mutate(parsedToImportRequest(step.parsed));
  }

  return (
    <div className={`mx-auto ${containerWidth}`}>
      {step.kind === "import" && (
        <ApkgUploader onContinue={handleParsed} />
      )}

      {step.kind === "flashcards" && (
        <FlashcardViewer
          parsed={step.parsed}
          onBack={() => setStep({ kind: "import" })}
          onStartTest={() => setStep({ kind: "apkg-setup", parsed: step.parsed })}
        />
      )}

      {step.kind === "apkg-setup" && (
        <ApkgQuizSetup
          parsed={step.parsed}
          onBack={() => setStep({ kind: "flashcards", parsed: step.parsed })}
          onStart={(questions) => startTrial(step.parsed, questions)}
        />
      )}

      {step.kind === "apkg-quiz" && (
        <>
          <QuizSession
            onRetry={() => startTrial(step.parsed, step.questions)}
            onExit={() => {
              setSettingsOpen(false);
              setStep({ kind: "apkg-setup", parsed: step.parsed });
            }}
            onEndTest={() => {
              setSettingsOpen(false);
              setStep({ kind: "flashcards", parsed: step.parsed });
            }}
            onOpenSettings={() => setSettingsOpen(true)}
            inputDisabled={settingsOpen}
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

      {!toastDismissed && importDeck.status === "pending" && (
        <Toast
          kind="pending"
          message="Saving deck to your account…"
          onDismiss={() => setToastDismissed(true)}
        />
      )}
      {!toastDismissed && importDeck.status === "success" && (
        <Toast
          kind="success"
          message="Saved to your decks"
          onDismiss={() => setToastDismissed(true)}
        />
      )}
      {!toastDismissed && importDeck.status === "error" && (
        <Toast
          kind="error"
          message="Couldn't save this deck to your account."
          actionLabel="Retry"
          onAction={retrySave}
          onDismiss={() => setToastDismissed(true)}
        />
      )}
    </div>
  );
}
