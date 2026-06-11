"use client";

import { useState } from "react";
import { Modal } from "@/components/shared/Modal";
import { ApkgUploader } from "@/components/deck/ApkgUploader";
import { buildFlashcards } from "@/lib/flashcards";
import { parsePlainText } from "@/lib/parsePlainText";
import { basicRow, type EditorRow } from "@/lib/deckEditor";
import type { ApkgParseResponse } from "@/types/api";

export type ImportMode = "append" | "replace";

// Brings more cards into the editor draft. Two sources — an .apkg file (flattened
// to Basic Front/Back rows) or Quizlet-style pasted text — and two modes: append to
// the bottom, or replace the whole set. Nothing is saved here; the editor merges
// the returned rows into its draft and the user still has to hit Save.
export function ImportCardsModal({
  onClose,
  onImport,
}: {
  onClose: () => void;
  onImport: (rows: EditorRow[], mode: ImportMode) => void;
}) {
  const [source, setSource] = useState<"file" | "text">("text");
  const [mode, setMode] = useState<ImportMode>("append");
  const [text, setText] = useState("");
  // Escaped forms so they match the <option value> strings; parsePlainText turns
  // "\t"/"\n" back into a real tab/newline.
  const [termDelimiter, setTermDelimiter] = useState("\\t");
  const [rowDelimiter, setRowDelimiter] = useState("\\n");

  function rowsFromParsed(parsed: ApkgParseResponse): EditorRow[] {
    return buildFlashcards(parsed.noteTypes).map((c) =>
      basicRow(c.front.join(" "), c.back.join(" ")),
    );
  }

  function commit(rows: EditorRow[]) {
    if (rows.length === 0) return;
    onImport(rows, mode);
    onClose();
  }

  const textRows = parsePlainText(text, { termDelimiter, rowDelimiter });

  return (
    <Modal title="Import cards" onClose={onClose}>
      <div className="space-y-5">
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">How to add them</legend>
          <div className="flex flex-wrap gap-4">
            <Radio name="mode" label="Append to the end" checked={mode === "append"} onChange={() => setMode("append")} />
            <Radio name="mode" label="Replace the entire set" checked={mode === "replace"} onChange={() => setMode("replace")} />
          </div>
          {mode === "replace" && (
            <p className="rounded-input border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
              Replacing removes every current card (and its study progress) when you
              Save.
            </p>
          )}
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Source</legend>
          <div className="flex flex-wrap gap-4">
            <Radio name="source" label="Paste text" checked={source === "text"} onChange={() => setSource("text")} />
            <Radio name="source" label="Upload .apkg" checked={source === "file"} onChange={() => setSource("file")} />
          </div>
        </fieldset>

        {source === "text" && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-1.5">
                Between term & definition:
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
              rows={8}
              placeholder={"term\tdefinition\nterm\tdefinition"}
              className="nice-scroll focus-ring w-full resize-y rounded-input border border-line-strong bg-surface-2 px-3 py-2 font-mono text-sm text-ink outline-none placeholder:text-faint"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">
                {textRows.length} card{textRows.length === 1 ? "" : "s"} detected
              </span>
              <button
                type="button"
                disabled={textRows.length === 0}
                onClick={() => commit(textRows.map((p) => basicRow(p.front, p.back)))}
                className="focus-ring rounded-input bg-accent px-3 py-1.5 text-sm font-semibold text-white shadow-btn transition hover:opacity-95 disabled:opacity-50"
              >
                {mode === "append" ? "Add cards" : "Replace cards"}
              </button>
            </div>
          </div>
        )}

        {source === "file" && (
          <div className="space-y-2">
            <p className="text-xs text-muted">
              Cards from the file are added as Basic (front/back) cards.
            </p>
            <ApkgUploader onContinue={(parsed) => commit(rowsFromParsed(parsed))} />
          </div>
        )}
      </div>
    </Modal>
  );
}

function Radio({
  name,
  label,
  checked,
  onChange,
}: {
  name: string;
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex items-center gap-1.5 text-sm">
      <input type="radio" name={name} checked={checked} onChange={onChange} />
      {label}
    </label>
  );
}
