"use client";

import { useState } from "react";
import { ApkgUploader } from "@/components/deck/ApkgUploader";
import { FlashcardViewer } from "@/components/deck/FlashcardViewer";
import { ApkgQuizSetup } from "@/components/deck/ApkgQuizSetup";
import { QuizSession } from "@/components/quiz/QuizSession";
import { Modal } from "@/components/shared/Modal";
import { useImportContext } from "@/components/import/ImportProvider";
import { reshuffleQuestions, type Question } from "@/lib/buildQuestions";
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
  const startSession = useQuizStore((s) => s.startSession);
  // The deck-save mutation + its status toast live in AppShell's ImportProvider,
  // so navigating away mid-save keeps the toast visible and the deck still
  // arrives in the dashboard list once the POST completes.
  const { startImport } = useImportContext();

  // /import is logged-in only, so a successfully parsed .apkg is auto-saved to the
  // user's decks. The flashcard/test flow continues regardless of the save result.
  function handleParsed(parsed: ApkgParseResponse) {
    setStep({ kind: "flashcards", parsed });
    startImport(parsed);
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
    </div>
  );
}
