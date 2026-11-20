"use client";

import { useState } from "react";
import { Modal } from "@/components/shared/Modal";
import { ApkgUploader } from "@/components/deck/ApkgUploader";
import { buildFlashcards } from "@/lib/flashcards";
import { parsePlainText } from "@/lib/parsePlainText";
import { basicRow, type EditorRow } from "@/lib/deckEditor";
import type { ApkgParseResponse } from "@/types/api";
import { useT } from "@/components/i18n/LocaleProvider";
import { Select } from "@/components/ui/Select";

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
  const t = useT();
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
    <Modal title={t("editor.importCards")} onClose={onClose}>
      <div className="space-y-5">
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{t("importModal.howToAdd")}</legend>
          <div className="flex flex-wrap gap-4">
            <Radio
              name="mode"
              label={t("importModal.append")}
              checked={mode === "append"}
              onChange={() => setMode("append")}
            />
            <Radio
              name="mode"
              label={t("importModal.replace")}
              checked={mode === "replace"}
              onChange={() => setMode("replace")}
            />
          </div>
          {mode === "replace" && (
            <p className="rounded-input border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
              {t("importModal.replaceWarning")}
            </p>
          )}
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{t("importModal.source")}</legend>
          <div className="flex flex-wrap gap-4">
            <Radio
              name="source"
              label={t("importModal.pasteText")}
              checked={source === "text"}
              onChange={() => setSource("text")}
            />
            <Radio
              name="source"
              label={t("importModal.uploadApkg")}
              checked={source === "file"}
              onChange={() => setSource("file")}
            />
          </div>
        </fieldset>

        {source === "text" && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-4 text-sm">
              <span className="flex items-center gap-1.5">
                {t("import.betweenTermDef")}
                <Select
                  value={termDelimiter}
                  options={[
                    { value: "\\t", label: t("import.delimTab") },
                    { value: ",", label: t("import.delimComma") },
                  ]}
                  onChange={setTermDelimiter}
                  ariaLabel={t("import.betweenTermDef")}
                  size="sm"
                />
              </span>
              <span className="flex items-center gap-1.5">
                {t("import.betweenRows")}
                <Select
                  value={rowDelimiter}
                  options={[
                    { value: "\\n", label: t("import.delimNewline") },
                    { value: ";", label: t("import.delimSemicolon") },
                  ]}
                  onChange={setRowDelimiter}
                  ariaLabel={t("import.betweenRows")}
                  size="sm"
                />
              </span>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              placeholder={t("import.pastePlaceholder")}
              className="nice-scroll focus-ring w-full resize-y rounded-input border border-line-strong bg-surface-2 px-3 py-2 font-mono text-sm text-ink outline-none placeholder:text-faint"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">
                {t("import.cardsDetected", { count: textRows.length })}
              </span>
              <button
                type="button"
                disabled={textRows.length === 0}
                onClick={() => commit(textRows.map((p) => basicRow(p.front, p.back)))}
                className="focus-ring rounded-input bg-accent px-3 py-1.5 text-sm font-semibold text-white shadow-btn transition hover:opacity-95 disabled:opacity-50"
              >
                {mode === "append" ? t("importModal.addCards") : t("importModal.replaceCards")}
              </button>
            </div>
          </div>
        )}

        {source === "file" && (
          <div className="space-y-2">
            <p className="text-xs text-muted">
              {t("importModal.apkgNote")}
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
