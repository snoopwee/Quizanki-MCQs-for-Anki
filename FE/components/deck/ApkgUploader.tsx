"use client";

import { useRef, useState } from "react";
import axios from "axios";
import { useParseApkg } from "@/hooks/useParseApkg";
import type { ApkgParseResponse } from "@/types/api";

// Mirrors the backend multipart cap; checked client-side so an oversized deck
// gets a clear message instead of a confusing dropped connection.
const MAX_BYTES = 50 * 1024 * 1024;
const MAX_MB = MAX_BYTES / 1024 / 1024;

function errorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const msg = (err.response?.data as { message?: string } | undefined)?.message;
    if (msg) return msg;
    if (err.response?.status === 413) return `That file is too large (limit ${MAX_MB} MB).`;
  }
  return "Could not parse the file. Please try a different .apkg.";
}

export function ApkgUploader({
  onContinue,
  hideHeading = false,
}: {
  onContinue?: (result: ApkgParseResponse) => void;
  hideHeading?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
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
        `That deck is ${(file.size / 1024 / 1024).toFixed(0)} MB — the limit is ${MAX_MB} MB.`,
      );
      return;
    }
    parse.mutate(file);
  }

  return (
    <div className="space-y-4">
      {!hideHeading && (
        <div>
          <h2 className="text-lg font-semibold">Import from an .apkg file</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Upload an Anki deck export (.apkg). We read the cards only — images and audio in your
            deck aren&apos;t uploaded.
          </p>
        </div>
      )}

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
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFile(e.dataTransfer.files?.[0]);
        }}
        className={`group flex min-h-[14rem] w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors disabled:cursor-wait ${
          dragOver
            ? "border-neutral-900 bg-neutral-50 dark:border-neutral-200 dark:bg-neutral-900"
            : "border-neutral-300 hover:border-neutral-400 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:border-neutral-600 dark:hover:bg-neutral-900/50"
        }`}
      >
        <span
          aria-hidden
          className="flex h-12 w-12 items-center justify-center rounded-xl border border-neutral-300 bg-white text-neutral-700 shadow-sm transition-transform group-hover:-translate-y-0.5 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
        >
          {parse.isPending ? (
            <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" opacity="0.25" />
              <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          ) : (
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 16V4m0 0L8 8m4-4 4 4M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </span>
        <span className="text-sm font-medium">
          {parse.isPending ? "Reading your deck…" : "Drop your .apkg here, or click to browse"}
        </span>
        <span className="text-xs text-neutral-500">Anki deck export · up to {MAX_MB} MB</span>
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
  // A note type can drive a quiz if it's a cloze type (each {{c<n>::...}} is a
  // card) OR a basic type with ≥2 text fields (prompt + answer).
  const usable = result.noteTypes.filter(
    (t) => t.noteCount > 0 && (t.cloze || t.fieldNames.length >= 2),
  );

  return (
    <div className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <p className="text-sm">
        <span className="font-medium">{result.filename}</span> — {result.totalNotes} notes
        {result.skippedNotes > 0 && `, ${result.skippedNotes} skipped`}
        {result.imageOnlyNotes > 0 &&
          `, ${result.imageOnlyNotes} image-occlusion excluded`}{" "}
        across {result.noteTypes.length} note type
        {result.noteTypes.length === 1 ? "" : "s"}.
      </p>
      {result.imageOnlyNotes > 0 && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300">
          Image-occlusion cards aren&apos;t supported in multiple-choice quizzes — they have no
          text to ask about. {result.imageOnlyNotes} card{result.imageOnlyNotes === 1 ? "" : "s"}{" "}
          excluded.
        </p>
      )}

      <ul className="space-y-2">
        {result.noteTypes.map((t) => (
          <li key={t.id} className="rounded-md bg-neutral-50 p-3 text-sm dark:bg-neutral-900">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{t.name}</span>
              <span className="text-neutral-500">· {t.noteCount} notes</span>
              {t.cloze && (
                <span className="rounded bg-sky-100 px-1.5 py-0.5 text-xs text-sky-800 dark:bg-sky-900/40 dark:text-sky-300">
                  cloze
                </span>
              )}
            </div>
            <p className="mt-1 truncate text-xs text-neutral-500">{t.fieldNames.join(" · ")}</p>
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
          className="w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          Continue →
        </button>
      )}
    </div>
  );
}
