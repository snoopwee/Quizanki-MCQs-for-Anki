"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/shared/Modal";
import { Spinner } from "@/components/ui/Spinner";
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
import { useExportApkg, useExportMcqApkg, useMcqExportPreview } from "@/hooks/useDecks";
import type { DeckContentsResponse } from "@/types/api";

type Format = "delimited" | "apkg" | "mcq" | "text";
type TermPreset = "tab" | "comma" | "custom";
type RowPreset = "newline" | "semicolon" | "custom";

const FORMATS: { value: Format; label: string; hint: string }[] = [
  { value: "delimited", label: "CSV / TSV", hint: "Spreadsheet or Anki re-import — one row per card." },
  { value: "apkg", label: "Anki .apkg", hint: "A real Anki package that opens straight back in Anki." },
  {
    value: "mcq",
    label: "Anki multiple choice",
    hint: "Every card becomes a quiz question you answer inside Anki.",
  },
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
  const exportMcq = useExportMcqApkg(contents.id);
  // Only asked for once that format is chosen — no point costing a request for a deck the user is
  // exporting as CSV.
  const mcqPreview = useMcqExportPreview(contents.id, format === "mcq");

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
    if (format === "mcq") {
      exportMcq.mutate(`${stem}-mcq.apkg`);
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
                className={`cursor-pointer rounded-input border p-3 text-sm transition ${
                  format === f.value
                    ? "border-accent bg-accent-soft"
                    : "border-line hover:border-line-strong"
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
                <span className="mt-0.5 block text-xs text-muted">{f.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {format === "mcq" && (
          <div className="space-y-2 rounded-card border border-line bg-surface p-3 text-sm">
            {mcqPreview.isLoading && (
              <p className="flex items-center gap-2 text-muted">
                <Spinner className="h-3.5 w-3.5" /> Checking which cards can become questions…
              </p>
            )}

            {mcqPreview.isError && (
              <p className="text-danger">
                Could not check this deck. Try again, or download and see what you get.
              </p>
            )}

            {mcqPreview.data && (
              <>
                {mcqPreview.data.exportedCards > 0 ? (
                  <p className="font-medium">
                    {mcqPreview.data.exportedCards} of {mcqPreview.data.totalCards} cards become
                    multiple-choice questions.
                  </p>
                ) : (
                  /* Being explicit beats handing over an empty package and letting them find out
                     in Anki. */
                  <p className="font-medium text-danger">
                    None of this deck&apos;s cards can become questions.
                  </p>
                )}

                {/* Naming WHY, not just how many — "2 skipped" with no reason reads like a bug. */}
                {Object.entries(mcqPreview.data.skippedReasons).length > 0 && (
                  <ul className="space-y-0.5 text-xs text-muted">
                    {Object.entries(mcqPreview.data.skippedReasons).map(([reason, count]) => (
                      <li key={reason}>
                        {count} skipped — {reason.toLowerCase()}
                      </li>
                    ))}
                  </ul>
                )}

                <p className="text-xs text-muted">
                  The wrong answers come from this deck&apos;s own other cards, and Anki shuffles
                  them on every review. Pictures and audio travel with it.
                </p>
              </>
            )}
          </div>
        )}

        {format === "delimited" && (
          <div className="space-y-3 rounded-card border border-line bg-surface p-3">
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
              <p className="text-xs text-muted">
                This deck has multiple note types — each is exported as its own
                block, prefixed with a <code># name</code> line.
              </p>
            )}
          </div>
        )}

        {format === "text" && (
          <div className="space-y-3 rounded-card border border-line bg-surface p-3">
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
                className="focus-ring w-full rounded-input border border-line-strong bg-surface-2 px-2 py-1 text-sm text-ink outline-none"
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
                className="focus-ring w-full rounded-input border border-line-strong bg-surface-2 px-2 py-1 text-sm text-ink outline-none"
              />
            )}
          </div>
        )}

        {format === "apkg" && (
          <p className="rounded-input bg-surface-2 px-3 py-2 text-xs text-muted">
            Builds an Anki package on the server and downloads it. Card progress
            isn&apos;t included — just the notes and their fields.
          </p>
        )}

        {preview && (
          <div className="space-y-1">
            <span className="font-mono text-xs font-medium text-faint">Preview</span>
            <pre className="nice-scroll max-h-32 overflow-auto rounded-input bg-surface-2 p-2 text-xs text-ink">
              {preview}
            </pre>
          </div>
        )}

        {exportApkg.isError && (
          <p className="text-sm text-danger">
            Couldn&apos;t build the .apkg. Please try again.
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-input border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium transition hover:border-accent hover:text-accent"
          >
            Close
          </button>
          {format !== "apkg" && (
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-input border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium transition hover:border-accent hover:text-accent"
            >
              {copied ? "Copied ✓" : "Copy to clipboard"}
            </button>
          )}
          <button
            type="button"
            onClick={handleDownload}
            disabled={
              exportApkg.isPending ||
              exportMcq.isPending ||
              // Nothing to download, so do not offer it.
              (format === "mcq" && mcqPreview.data?.exportedCards === 0)
            }
            className="focus-ring rounded-input bg-accent px-3 py-1.5 text-sm font-semibold text-white shadow-btn transition hover:opacity-95 disabled:opacity-60"
          >
            {format === "apkg"
              ? exportApkg.isPending
                ? "Building…"
                : "Download .apkg"
              : format === "mcq"
                ? exportMcq.isPending
                  ? "Building…"
                  : "Download quiz deck"
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
