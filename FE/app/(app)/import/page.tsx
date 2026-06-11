"use client";

import { useMemo, useState } from "react";
import { ApkgUploader } from "@/components/deck/ApkgUploader";
import { FlashcardViewer } from "@/components/deck/FlashcardViewer";
import { useImportContext } from "@/components/import/ImportProvider";
import { parsePlainText, type ParsedPair } from "@/lib/parsePlainText";
import { plainTextToImportRequest, plainTextToParsed } from "@/lib/plainTextDeck";
import type { ApkgParseResponse } from "@/types/api";

// /import is the auth-only "bring in a deck, get it saved" flow. Quizzes are
// launched from the dashboard / deck detail screens, not this page — so we
// only need two steps: choose a source (an .apkg file or pasted Quizlet-style
// text), then browse the flashcards it produced.
// The guest landing page (/) keeps the full parse → quiz → save flow.
type Step =
  | { kind: "import" }
  | { kind: "flashcards"; parsed: ApkgParseResponse };

type Source = "file" | "text";

export default function ImportPage() {
  const [step, setStep] = useState<Step>({ kind: "import" });
  const [source, setSource] = useState<Source>("file");
  // The deck-save mutation + its status toast live in AppShell's ImportProvider,
  // so navigating away mid-save keeps the toast visible and the deck still
  // arrives in the dashboard list once the POST completes.
  const { startImport, startImportRequest } = useImportContext();

  // /import is logged-in only, so a successfully parsed .apkg is auto-saved to
  // the user's decks. The flashcard step is just for browsing what was imported.
  function handleParsed(parsed: ApkgParseResponse) {
    setStep({ kind: "flashcards", parsed });
    startImport(parsed);
  }

  return (
    <div className="mx-auto max-w-2xl">
      {step.kind === "import" && (
        <div className="space-y-5">
          <div className="inline-flex rounded-input border border-line bg-surface p-0.5 text-sm">
            <SourceTab label="Upload .apkg" active={source === "file"} onClick={() => setSource("file")} />
            <SourceTab label="Paste text" active={source === "text"} onClick={() => setSource("text")} />
          </div>

          {source === "file" && <ApkgUploader onContinue={handleParsed} />}
          {source === "text" && (
            <PasteTextImport
              onImport={(name, pairs) => {
                setStep({ kind: "flashcards", parsed: plainTextToParsed(name, pairs) });
                startImportRequest(plainTextToImportRequest(name, pairs));
              }}
            />
          )}
        </div>
      )}

      {step.kind === "flashcards" && (
        <div className="space-y-5">
          <button
            type="button"
            onClick={() => setStep({ kind: "import" })}
            className="rounded-input border border-line-strong bg-surface px-4 py-2 text-sm font-medium transition hover:border-accent hover:text-accent"
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

function SourceTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[7px] px-3 py-1.5 font-medium transition-colors ${
        active ? "bg-accent-soft text-accent-ink" : "text-muted hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}

// Quizlet-style paste: a deck name, two configurable separators, and a textarea.
// Mirrors the in-editor Import-cards modal so the two paste paths feel identical.
function PasteTextImport({
  onImport,
}: {
  onImport: (name: string, pairs: ParsedPair[]) => void;
}) {
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  // Escaped forms so they match the <option value> strings; parsePlainText turns
  // "\t"/"\n" back into a real tab/newline.
  const [termDelimiter, setTermDelimiter] = useState("\\t");
  const [rowDelimiter, setRowDelimiter] = useState("\\n");

  const pairs = useMemo(
    () => parsePlainText(text, { termDelimiter, rowDelimiter }),
    [text, termDelimiter, rowDelimiter],
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight">Import from plain text</h2>
        <p className="mt-1 text-sm text-muted">
          Paste cards Quizlet-style — one card per row, term and definition
          separated by your chosen delimiter. Each becomes a Basic (front/back) card.
        </p>
      </div>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Deck name</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Untitled deck"
          className="focus-ring w-full rounded-input border border-line-strong bg-surface-2 px-3 py-2 text-sm text-ink outline-none placeholder:text-faint"
        />
      </label>

      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-1.5">
          Between term &amp; definition:
          <select
            value={termDelimiter}
            onChange={(e) => setTermDelimiter(e.target.value)}
            className="rounded-input border border-line-strong bg-surface-2 px-1 py-0.5 text-ink"
          >
            <option value="\t">Tab</option>
            <option value=",">Comma</option>
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          Between rows:
          <select
            value={rowDelimiter}
            onChange={(e) => setRowDelimiter(e.target.value)}
            className="rounded-input border border-line-strong bg-surface-2 px-1 py-0.5 text-ink"
          >
            <option value="\n">New line</option>
            <option value=";">Semicolon</option>
          </select>
        </label>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={10}
        placeholder={"term\tdefinition\nterm\tdefinition"}
        className="nice-scroll focus-ring w-full resize-y rounded-input border border-line-strong bg-surface-2 px-3 py-2 font-mono text-sm text-ink outline-none placeholder:text-faint"
      />

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted">
          {pairs.length} card{pairs.length === 1 ? "" : "s"} detected
        </span>
        <button
          type="button"
          disabled={pairs.length === 0}
          onClick={() => onImport(name, pairs)}
          className="focus-ring rounded-input bg-accent px-4 py-2 text-sm font-semibold text-white shadow-btn transition hover:opacity-95 disabled:opacity-50"
        >
          Import {pairs.length > 0 ? `${pairs.length} card${pairs.length === 1 ? "" : "s"}` : "cards"}
        </button>
      </div>
    </div>
  );
}
