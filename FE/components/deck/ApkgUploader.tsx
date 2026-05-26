"use client";

import { useRef, useState } from "react";
import axios from "axios";
import { useParseApkg } from "@/hooks/useParseApkg";
import type { ApkgParseResponse } from "@/types/api";

// Mirrors the backend multipart cap; checked client-side so an oversized deck
// gets a clear message instead of a confusing dropped connection.
const MAX_BYTES = 100 * 1024 * 1024;

function errorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const msg = (err.response?.data as { message?: string } | undefined)?.message;
    if (msg) return msg;
    if (err.response?.status === 413) return "That file is too large (limit 100 MB).";
  }
  return "Could not parse the file. Please try a different .apkg.";
}

export function ApkgUploader({ onContinue }: { onContinue?: (result: ApkgParseResponse) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const parse = useParseApkg();

  function handleFile(file: File | undefined) {
    setValidationError(null);
    parse.reset();
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".apkg")) {
      setValidationError("Please choose a .apkg file (an Anki deck export).");
      return;
    }
    if (file.size > MAX_BYTES) {
      setValidationError(
        `That deck is ${(file.size / 1024 / 1024).toFixed(0)} MB — the limit is 100 MB.`,
      );
      return;
    }
    parse.mutate(file);
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Import from an .apkg file</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Upload an Anki deck export (.apkg). We read the cards only — images and audio in your deck
          aren&apos;t uploaded.
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".apkg"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={parse.isPending}
        className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
      >
        {parse.isPending ? "Parsing…" : "Choose .apkg file"}
      </button>

      {validationError && (
        <p className="text-sm text-red-600 dark:text-red-400">{validationError}</p>
      )}
      {parse.isError && (
        <p className="text-sm text-red-600 dark:text-red-400">{errorMessage(parse.error)}</p>
      )}

      {parse.data && <ApkgSummary result={parse.data} onContinue={onContinue} />}
    </div>
  );
}

function ApkgSummary({
  result,
  onContinue,
}: {
  result: ApkgParseResponse;
  onContinue?: (result: ApkgParseResponse) => void;
}) {
  // A note type can drive a quiz only with ≥2 text fields (prompt + answer).
  const usable = result.noteTypes.filter((t) => t.fieldNames.length >= 2 && t.noteCount > 0);

  return (
    <div className="space-y-3 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <p className="text-sm">
        <span className="font-medium">{result.filename}</span> — {result.totalNotes} notes
        {result.skippedNotes > 0 && `, ${result.skippedNotes} skipped`} across{" "}
        {result.noteTypes.length} note type{result.noteTypes.length === 1 ? "" : "s"}.
      </p>

      <ul className="space-y-2">
        {result.noteTypes.map((t) => (
          <li key={t.id} className="rounded-md bg-neutral-50 p-3 text-sm dark:bg-neutral-900">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{t.name}</span>
              <span className="text-neutral-500">· {t.noteCount} notes</span>
              {t.cloze && (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                  cloze
                </span>
              )}
            </div>
            <p className="mt-1 truncate text-xs text-neutral-500">{t.fieldNames.join(" · ")}</p>
            {t.cloze && (
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                Cloze cards aren&apos;t fully supported yet — answers may not generate well.
              </p>
            )}
          </li>
        ))}
      </ul>

      <p className="text-xs text-neutral-500">
        Decks that use an image or audio as the <em>answer</em> may not be supported.
        {usable.length === 0 && " None of these note types look ready for a text quiz yet."}
      </p>

      {onContinue && (
        <button
          type="button"
          disabled={usable.length === 0}
          onClick={() => onContinue(result)}
          className="w-full rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
        >
          Continue →
        </button>
      )}
    </div>
  );
}
