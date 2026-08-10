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
          <h2 className="font-display text-lg font-semibold tracking-tight">Import from an .apkg file</h2>
          <p className="mt-1 text-sm text-muted">
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
        className={`group flex min-h-[14rem] w-full flex-col items-center justify-center gap-3 rounded-card border-2 border-dashed px-6 py-12 text-center transition-colors disabled:cursor-wait ${
          dragOver
            ? "border-accent bg-accent-soft"
            : "border-line-strong hover:border-accent hover:bg-accent-soft/40"
        }`}
      >
        <span
          aria-hidden
          className="flex h-12 w-12 items-center justify-center rounded-input border border-line bg-surface text-accent shadow-sm transition-transform group-hover:-translate-y-0.5"
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
        <span className="text-sm font-medium text-ink">
          {parse.isPending ? "Reading your deck…" : "Drop your .apkg here, or click to browse"}
        </span>
        <span className="font-mono text-xs text-faint">Anki deck export · up to {MAX_MB} MB</span>
      </button>

      {validationError && <p className="text-sm text-danger">{validationError}</p>}
      {parse.isError && <p className="text-sm text-danger">{errorMessage(parse.error)}</p>}

      {/* AnkiWeb only lets you download shared decks from its own site, so we point
          there rather than fetching for you — grab the .apkg, then drop it above. */}
      <p className="text-xs text-muted">
        Need a deck?{" "}
        <a
          href="https://ankiweb.net/shared/decks"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-accent underline-offset-2 hover:underline"
        >
          Browse AnkiWeb shared decks ↗
        </a>{" "}
        — download the .apkg from AnkiWeb, then upload it here.
      </p>

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
    <div className="space-y-3 rounded-card border border-line bg-surface-2/50 p-4">
      <p className="text-sm text-ink">
        <span className="font-medium">{result.filename}</span> — {result.totalNotes} notes
        {result.skippedNotes > 0 && `, ${result.skippedNotes} skipped`}
        {result.imageOnlyNotes > 0 &&
          `, ${result.imageOnlyNotes} image-occlusion excluded`}{" "}
        across {result.noteTypes.length} note type
        {result.noteTypes.length === 1 ? "" : "s"}.
      </p>
      {result.imageOnlyNotes > 0 && (
        <p className="rounded-input border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          Image-occlusion cards aren&apos;t supported in multiple-choice quizzes — they have no
          text to ask about. {result.imageOnlyNotes} card{result.imageOnlyNotes === 1 ? "" : "s"}{" "}
          excluded.
        </p>
      )}

      <ul className="space-y-2">
        {result.noteTypes.map((t) => (
          <li key={t.id} className="rounded-input border border-line bg-surface p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-ink">{t.name}</span>
              <span className="text-muted">· {t.noteCount} notes</span>
              {t.cloze && (
                <span className="rounded-tag bg-info/15 px-1.5 py-0.5 font-mono text-xs text-info">
                  cloze
                </span>
              )}
            </div>
            <p className="mt-1 truncate font-mono text-xs text-faint">{t.fieldNames.join(" · ")}</p>
          </li>
        ))}
      </ul>

      <p className="text-xs text-faint">
        Decks that use an image or audio as the <em>answer</em> may not be supported.
        {usable.length === 0 && " None of these note types look ready for a text quiz yet."}
      </p>

      {onContinue && (
        <button
          type="button"
          disabled={usable.length === 0}
          onClick={() => onContinue(result)}
          className="focus-ring w-full rounded-input bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-btn transition hover:opacity-95 disabled:opacity-50"
        >
          Continue →
        </button>
      )}
    </div>
  );
}
