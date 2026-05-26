"use client";

import { useState } from "react";
import Link from "next/link";
import { ApkgUploader } from "@/components/deck/ApkgUploader";
import { ApkgQuizSetup } from "@/components/deck/ApkgQuizSetup";
import { DeckImporter } from "@/components/deck/DeckImporter";
import { FieldDetector } from "@/components/deck/FieldDetector";
import { QuizSession } from "@/components/quiz/QuizSession";
import type { ParseResult } from "@/lib/parseDeck";
import type { Question } from "@/lib/buildQuestions";
import { useQuizStore } from "@/stores/quizStore";
import type { ApkgParseResponse, DeckResponse } from "@/types/api";

type Step =
  | { kind: "import" }
  | { kind: "detect"; result: ParseResult }
  | { kind: "apkg-setup"; parsed: ApkgParseResponse }
  | { kind: "apkg-quiz"; parsed: ApkgParseResponse; questions: Question[] }
  | { kind: "done"; deck: DeckResponse };

export default function ImportPage() {
  const [step, setStep] = useState<Step>({ kind: "import" });
  const startSession = useQuizStore((s) => s.startSession);

  // Trial quiz: no backend session, so an empty sessionId keeps QuizSession from
  // recording answers. Saving comes later (Chunk 3) via POST /decks.
  function startTrial(parsed: ApkgParseResponse, questions: Question[]) {
    startSession(questions, "");
    setStep({ kind: "apkg-quiz", parsed, questions });
  }

  return (
    <div className="mx-auto max-w-2xl">
      {step.kind === "import" && (
        <div className="space-y-8">
          <ApkgUploader onContinue={(parsed) => setStep({ kind: "apkg-setup", parsed })} />
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

      {step.kind === "apkg-setup" && (
        <ApkgQuizSetup
          parsed={step.parsed}
          onBack={() => setStep({ kind: "import" })}
          onStart={(questions) => startTrial(step.parsed, questions)}
        />
      )}

      {step.kind === "apkg-quiz" && (
        <QuizSession
          onRetry={() => startTrial(step.parsed, step.questions)}
          onExit={() => setStep({ kind: "apkg-setup", parsed: step.parsed })}
        />
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
