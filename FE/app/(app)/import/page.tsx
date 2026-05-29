"use client";

import { useState } from "react";
import { ApkgUploader } from "@/components/deck/ApkgUploader";
import { FlashcardViewer } from "@/components/deck/FlashcardViewer";
import { useImportContext } from "@/components/import/ImportProvider";
import type { ApkgParseResponse } from "@/types/api";

// /import is the auth-only "upload a deck, get it saved" flow. Quizzes are
// launched from the dashboard / deck detail screens, not this page — so we
// only need two steps: pick a file, then browse the flashcards it produced.
// The guest landing page (/) keeps the full parse → quiz → save flow.
type Step =
  | { kind: "import" }
  | { kind: "flashcards"; parsed: ApkgParseResponse };

export default function ImportPage() {
  const [step, setStep] = useState<Step>({ kind: "import" });
  // The deck-save mutation + its status toast live in AppShell's ImportProvider,
  // so navigating away mid-save keeps the toast visible and the deck still
  // arrives in the dashboard list once the POST completes.
  const { startImport } = useImportContext();

  // /import is logged-in only, so a successfully parsed .apkg is auto-saved to
  // the user's decks. The flashcard step is just for browsing what was imported.
  function handleParsed(parsed: ApkgParseResponse) {
    setStep({ kind: "flashcards", parsed });
    startImport(parsed);
  }

  return (
    <div className="mx-auto max-w-2xl">
      {step.kind === "import" && <ApkgUploader onContinue={handleParsed} />}

      {step.kind === "flashcards" && (
        <div className="space-y-5">
          <button
            type="button"
            onClick={() => setStep({ kind: "import" })}
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            ← Import another
          </button>
          {/* Quiz button intentionally omitted — authed users launch quizzes
              from the dashboard / deck detail page, where mastery is tracked. */}
          <FlashcardViewer
            parsed={step.parsed}
            hideActions
            onBack={() => setStep({ kind: "import" })}
          />
        </div>
      )}
    </div>
  );
}
