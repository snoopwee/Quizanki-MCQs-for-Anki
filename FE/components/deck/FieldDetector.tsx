"use client";

import { useMemo, useState } from "react";
import { detectFields } from "@/lib/detectFields";
import type { ParseResult } from "@/lib/parseDeck";
import { importDeckSchema } from "@/schemas/deck.schema";
import { useImportDeck } from "@/hooks/useDecks";
import { ConfidenceBadge } from "@/components/shared/ConfidenceBadge";
import type { DeckResponse, ImportDeckRequest } from "@/types/api";

function sampleValue(result: ParseResult, field: string): string {
  const found = result.notes.find((n) => (n.fields[field] ?? "").length > 0);
  return found ? found.fields[field] : "(empty)";
}

export function FieldDetector({
  result,
  onBack,
  onImported,
}: {
  result: ParseResult;
  onBack: () => void;
  onImported: (deck: DeckResponse) => void;
}) {
  const detection = useMemo(
    () => detectFields(result.notes, result.fieldNames),
    [result],
  );

  const [name, setName] = useState("");
  const [questionField, setQuestionField] = useState(detection.questionField);
  const [answerField, setAnswerField] = useState(detection.answerField);
  const [validationError, setValidationError] = useState<string | null>(null);

  const importMutation = useImportDeck();

  const sameField = questionField === answerField;

  function handleImport() {
    setValidationError(null);
    const request: ImportDeckRequest = {
      name: name.trim(),
      subdeckPath: null,
      questionField,
      answerField,
      detectionConfidence: detection.confidence,
      notes: result.notes.map((n) => ({ fields: n.fields, tags: n.tags })),
    };

    const parsed = importDeckSchema.safeParse(request);
    if (!parsed.success) {
      setValidationError(parsed.error.issues[0]?.message ?? "Invalid deck");
      return;
    }
    importMutation.mutate(request, { onSuccess: onImported });
  }

  const apiError = importMutation.isError
    ? (importMutation.error as { message?: string }).message ?? "Import failed"
    : null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Confirm fields</h1>
        <ConfidenceBadge confidence={detection.confidence} />
      </div>

      {detection.confidence < 0.7 && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          Detection is unsure about this deck — please review the question and answer fields below.
        </p>
      )}

      <div className="space-y-1.5">
        <label htmlFor="deck-name" className="text-sm font-medium">
          Deck name
        </label>
        <input
          id="deck-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="JLPT N4 Vocabulary"
          className="w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:focus:border-neutral-200"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FieldSelect
          label="Question field"
          value={questionField}
          fields={result.fieldNames}
          sample={sampleValue(result, questionField)}
          onChange={setQuestionField}
        />
        <FieldSelect
          label="Answer field"
          value={answerField}
          fields={result.fieldNames}
          sample={sampleValue(result, answerField)}
          onChange={setAnswerField}
        />
      </div>

      {sameField && (
        <p className="text-sm text-red-600 dark:text-red-400">
          Question and answer must be different fields.
        </p>
      )}
      {validationError && (
        <p className="text-sm text-red-600 dark:text-red-400">{validationError}</p>
      )}
      {apiError && <p className="text-sm text-red-600 dark:text-red-400">{apiError}</p>}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          Back
        </button>
        <button
          type="button"
          disabled={sameField || importMutation.isPending}
          onClick={handleImport}
          className="flex-1 rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
        >
          {importMutation.isPending ? "Importing…" : `Import ${result.notes.length} cards`}
        </button>
      </div>
    </div>
  );
}

function FieldSelect({
  label,
  value,
  fields,
  sample,
  onChange,
}: {
  label: string;
  value: string;
  fields: string[];
  sample: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:focus:border-neutral-200"
      >
        {fields.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </select>
      <p className="truncate text-xs text-neutral-500" title={sample}>
        e.g. {sample}
      </p>
    </div>
  );
}
