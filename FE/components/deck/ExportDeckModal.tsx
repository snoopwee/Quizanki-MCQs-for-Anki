"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/shared/Modal";
import { buildFlashcards } from "@/lib/flashcards";
import { deckContentsToParsed } from "@/lib/deckContents";
import {
  buildDelimited,
  buildQuizletText,
  downloadTextFile,
  exportFilename,
  interpretEscapes,
  type CsvDelimiter,
} from "@/lib/exportDeck";
import { useExportApkg } from "@/hooks/useDecks";
import type { DeckContentsResponse } from "@/types/api";

type Format = "delimited" | "apkg" | "text";
type TermPreset = "tab" | "comma" | "custom";
type RowPreset = "newline" | "semicolon" | "custom";

const FORMATS: { value: Format; label: string; hint: string }[] = [
  { value: "delimited", label: "CSV / TSV", hint: "Spreadsheet or Anki re-import — one row per card." },
  { value: "apkg", label: "Anki .apkg", hint: "A real Anki package that opens straight back in Anki." },
  { value: "text", label: "Plain text", hint: "Quizlet-style — paste into Quizlet's import box." },
];

export function ExportDeckModal({
  contents,
  onClose,
}: {
  contents: DeckContentsResponse;
  onClose: () => void;
}) {
  const [format, setFormat] = useState<Format>("delimited");

  // CSV/TSV options
  const [delimiter, setDelimiter] = useState<CsvDelimiter>(",");
  const [includeTags, setIncludeTags] = useState(true);

  // Plain-text (Quizlet) options
  const [termPreset, setTermPreset] = useState<TermPreset>("tab");
  const [termCustom, setTermCustom] = useState("-");
  const [rowPreset, setRowPreset] = useState<RowPreset>("newline");
  const [rowCustom, setRowCustom] = useState("\\n\\n");

  const [copied, setCopied] = useState(false);
  const exportApkg = useExportApkg(contents.id);

  const cards = useMemo(
    () => buildFlashcards(deckContentsToParsed(contents).noteTypes),
    [contents],
  );

  const termDelimiter =
    termPreset === "tab" ? "\t" : termPreset === "comma" ? "," : interpretEscapes(termCustom);
  const rowDelimiter =
    rowPreset === "newline"
      ? "\n"
      : rowPreset === "semicolon"
        ? ";"
        : interpretEscapes(rowCustom);

  const stem = exportFilename(contents.name);

  function textPayload(): { content: string; filename: string; mime: string; bom: boolean } {
    if (format === "text") {
      return {
        content: buildQuizletText(cards, { termDelimiter, rowDelimiter }),
        filename: `${stem}.txt`,
        mime: "text/plain",
        bom: false,
      };
    }
    return {
      content: buildDelimited(contents, { delimiter, includeTags }),
      filename: `${stem}.${delimiter === "," ? "csv" : "tsv"}`,
      mime: delimiter === "," ? "text/csv" : "text/tab-separated-values",
      bom: true,
    };
  }

  function handleDownload() {
    if (format === "apkg") {
      exportApkg.mutate(`${stem}.apkg`);
      return;
    }
    const { content, filename, mime, bom } = textPayload();
    downloadTextFile(filename, content, mime, bom);
  }

  async function handleCopy() {
    const { content } = textPayload();
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const preview = useMemo(() => {
    if (format === "apkg") return "";
    const { content } = textPayload();
    return content.split("\n").slice(0, 6).join("\n");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format, delimiter, includeTags, termDelimiter, rowDelimiter, cards, contents]);

  return (
    <Modal title="Export deck" onClose={onClose}>
      <div className="space-y-5">
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Format</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {FORMATS.map((f) => (
              <label
                key={f.value}
                className={`cursor-pointer rounded-lg border p-3 text-sm ${
                  format === f.value
                    ? "border-neutral-900 bg-neutral-50 dark:border-neutral-100 dark:bg-neutral-900"
                    : "border-neutral-200 dark:border-neutral-800"
                }`}
              >
                <input
                  type="radio"
                  name="export-format"
                  className="sr-only"
                  checked={format === f.value}
                  onChange={() => setFormat(f.value)}
                />
                <span className="block font-medium">{f.label}</span>
                <span className="mt-0.5 block text-xs text-neutral-500">{f.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {format === "delimited" && (
          <div className="space-y-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
            <RadioRow
              label="Separator"
              options={[
                { value: ",", label: "Comma (.csv)" },
                { value: "\t", label: "Tab (.tsv)" },
              ]}
              value={delimiter}
              onChange={(v) => setDelimiter(v as CsvDelimiter)}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeTags}
                onChange={(e) => setIncludeTags(e.target.checked)}
              />
              Include a Tags column
            </label>
            {contents.noteTypes.length > 1 && (
              <p className="text-xs text-neutral-500">
                This deck has multiple note types — each is exported as its own
                block, prefixed with a <code># name</code> line.
              </p>
            )}
          </div>
        )}

        {format === "text" && (
          <div className="space-y-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
            <RadioRow
              label="Between term and definition"
              options={[
                { value: "tab", label: "Tab" },
                { value: "comma", label: "Comma" },
                { value: "custom", label: "Custom" },
              ]}
              value={termPreset}
              onChange={(v) => setTermPreset(v as TermPreset)}
            />
            {termPreset === "custom" && (
              <input
                type="text"
                value={termCustom}
                onChange={(e) => setTermCustom(e.target.value)}
                placeholder="e.g. -"
                className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900"
              />
            )}
            <RadioRow
              label="Between rows"
              options={[
                { value: "newline", label: "New line" },
                { value: "semicolon", label: "Semicolon" },
                { value: "custom", label: "Custom" },
              ]}
              value={rowPreset}
              onChange={(v) => setRowPreset(v as RowPreset)}
            />
            {rowPreset === "custom" && (
              <input
                type="text"
                value={rowCustom}
                onChange={(e) => setRowCustom(e.target.value)}
                placeholder="e.g. \n\n"
                className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900"
              />
            )}
          </div>
        )}

        {format === "apkg" && (
          <p className="rounded-md bg-neutral-50 px-3 py-2 text-xs text-neutral-600 dark:bg-neutral-900 dark:text-neutral-300">
            Builds an Anki package on the server and downloads it. Card progress
            isn&apos;t included — just the notes and their fields.
          </p>
        )}

        {preview && (
          <div className="space-y-1">
            <span className="text-xs font-medium text-neutral-500">Preview</span>
            <pre className="nice-scroll max-h-32 overflow-auto rounded-md bg-neutral-50 p-2 text-xs text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
              {preview}
            </pre>
          </div>
        )}

        {exportApkg.isError && (
          <p className="text-sm text-red-600 dark:text-red-400">
            Couldn&apos;t build the .apkg. Please try again.
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-neutral-200 pt-4 dark:border-neutral-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            Close
          </button>
          {format !== "apkg" && (
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
            >
              {copied ? "Copied ✓" : "Copy to clipboard"}
            </button>
          )}
          <button
            type="button"
            onClick={handleDownload}
            disabled={exportApkg.isPending}
            className="rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
          >
            {format === "apkg"
              ? exportApkg.isPending
                ? "Building…"
                : "Download .apkg"
              : "Download"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function RadioRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex flex-wrap gap-3">
        {options.map((o) => (
          <label key={o.value} className="flex items-center gap-1.5 text-sm">
            <input
              type="radio"
              checked={value === o.value}
              onChange={() => onChange(o.value)}
            />
            {o.label}
          </label>
        ))}
      </div>
    </div>
  );
}
