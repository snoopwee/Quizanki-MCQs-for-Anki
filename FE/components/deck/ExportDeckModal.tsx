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
import { useT } from "@/components/i18n/LocaleProvider";
import type { MessageKey } from "@/lib/i18n/messages/en";

type Format = "delimited" | "apkg" | "mcq" | "text";
type TermPreset = "tab" | "comma" | "custom";
type RowPreset = "newline" | "semicolon" | "custom";

// Message keys, not text: a module-level const has no translator in scope.
const FORMATS: { value: Format; labelKey: MessageKey; hintKey: MessageKey }[] = [
  { value: "delimited", labelKey: "exportModal.csv", hintKey: "exportModal.csvHint" },
  { value: "apkg", labelKey: "exportModal.apkg", hintKey: "exportModal.apkgHint" },
  { value: "mcq", labelKey: "exportModal.mcq", hintKey: "exportModal.mcqHint" },
  { value: "text", labelKey: "exportModal.text", hintKey: "exportModal.textHint" },
];

export function ExportDeckModal({
  contents,
  onClose,
}: {
  contents: DeckContentsResponse;
  onClose: () => void;
}) {
  const t = useT();
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
    <Modal title={t("exportModal.title")} onClose={onClose}>
      <div className="space-y-5">
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{t("exportModal.format")}</legend>
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
                <span className="block font-medium">{t(f.labelKey)}</span>
                <span className="mt-0.5 block text-xs text-muted">{t(f.hintKey)}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {format === "mcq" && (
          <div className="space-y-2 rounded-card border border-line bg-surface p-3 text-sm">
            {mcqPreview.isLoading && (
              <p className="flex items-center gap-2 text-muted">
                <Spinner className="h-3.5 w-3.5" /> {t("export.checking")}
              </p>
            )}

            {mcqPreview.isError && (
              <p className="text-danger">
                {t("exportModal.checkFailedHere")}
              </p>
            )}

            {mcqPreview.data && (
              <>
                {mcqPreview.data.exportedCards > 0 ? (
                  <p className="font-medium">
                    {t("export.becomeQuestions", {
                      exported: mcqPreview.data.exportedCards,
                      total: mcqPreview.data.totalCards,
                    })}
                  </p>
                ) : (
                  /* Being explicit beats handing over an empty package and letting them find out
                     in Anki. */
                  <p className="font-medium text-danger">{t("export.noneQuizzable")}</p>
                )}

                {/* Naming WHY, not just how many — "2 skipped" with no reason reads like a bug. */}
                {Object.entries(mcqPreview.data.skippedReasons).length > 0 && (
                  <ul className="space-y-0.5 text-xs text-muted">
                    {Object.entries(mcqPreview.data.skippedReasons).map(([reason, count]) => (
                      <li key={reason}>
                        {/* ⚠ `reason` is the BACKEND's wording and stays English until the API
                            takes a locale. Better English than absent: the reason is the point. */}
                        {t("export.skippedReason", { count, reason: reason.toLowerCase() })}
                      </li>
                    ))}
                  </ul>
                )}

                <p className="text-xs text-muted">{t("exportModal.mcqNote")}</p>
              </>
            )}
          </div>
        )}

        {format === "delimited" && (
          <div className="space-y-3 rounded-card border border-line bg-surface p-3">
            <RadioRow
              label={t("exportModal.separator")}
              options={[
                { value: ",", label: t("exportModal.comma") },
                { value: "\t", label: t("exportModal.tab") },
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
              {t("exportModal.includeTags")}
            </label>
            {contents.noteTypes.length > 1 && (
              <p className="text-xs text-muted">
                {t("exportModal.multipleNoteTypes")}
              </p>
            )}
          </div>
        )}

        {format === "text" && (
          <div className="space-y-3 rounded-card border border-line bg-surface p-3">
            <RadioRow
              label={t("exportModal.betweenTermDef")}
              options={[
                { value: "tab", label: t("import.delimTab") },
                { value: "comma", label: t("import.delimComma") },
                { value: "custom", label: t("exportModal.custom") },
              ]}
              value={termPreset}
              onChange={(v) => setTermPreset(v as TermPreset)}
            />
            {termPreset === "custom" && (
              <input
                type="text"
                value={termCustom}
                onChange={(e) => setTermCustom(e.target.value)}
                placeholder={t("exportModal.customExample")}
                className="focus-ring w-full rounded-input border border-line-strong bg-surface-2 px-2 py-1 text-sm text-ink outline-none"
              />
            )}
            <RadioRow
              label={t("exportModal.betweenRows")}
              options={[
                { value: "newline", label: t("import.delimNewline") },
                { value: "semicolon", label: t("import.delimSemicolon") },
                { value: "custom", label: t("exportModal.custom") },
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
            {t("exportModal.apkgNote")}
          </p>
        )}

        {preview && (
          <div className="space-y-1">
            <span className="font-mono text-xs font-medium text-faint">{t("exportModal.preview")}</span>
            <pre className="nice-scroll max-h-32 overflow-auto rounded-input bg-surface-2 p-2 text-xs text-ink">
              {preview}
            </pre>
          </div>
        )}

        {exportApkg.isError && (
          <p className="text-sm text-danger">
            {t("exportModal.apkgFailed")}
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-input border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium transition hover:border-accent hover:text-accent"
          >
            {t("common.close")}
          </button>
          {format !== "apkg" && (
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-input border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium transition hover:border-accent hover:text-accent"
            >
              {copied ? t("exportModal.copied") : t("exportModal.copy")}
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
                ? t("export.building")
                : t("exportModal.downloadApkg")
              : format === "mcq"
                ? exportMcq.isPending
                  ? t("export.building")
                  : t("export.download")
                : t("exportModal.downloadPlain")}
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
