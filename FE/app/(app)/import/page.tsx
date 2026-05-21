"use client";

import { useState } from "react";
import Link from "next/link";
import { DeckImporter } from "@/components/deck/DeckImporter";
import { FieldDetector } from "@/components/deck/FieldDetector";
import type { ParseResult } from "@/lib/parseDeck";
import type { DeckResponse } from "@/types/api";

type Step =
  | { kind: "import" }
  | { kind: "detect"; result: ParseResult }
  | { kind: "done"; deck: DeckResponse };

export default function ImportPage() {
  const [step, setStep] = useState<Step>({ kind: "import" });

  return (
    <div className="mx-auto max-w-2xl">
      {step.kind === "import" && (
        <DeckImporter onContinue={(result) => setStep({ kind: "detect", result })} />
      )}

      {step.kind === "detect" && (
        <FieldDetector
          result={step.result}
          onBack={() => setStep({ kind: "import" })}
          onImported={(deck) => setStep({ kind: "done", deck })}
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
