"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/Spinner";
import { Select } from "@/components/ui/Select";
import {
  useDecks,
  useExportMcqApkg,
  useExportMcqFromUpload,
  useMcqExportPreview,
} from "@/hooks/useDecks";
import { useT } from "@/components/i18n/LocaleProvider";

/**
 * Turn a deck into multiple-choice cards you answer inside Anki.
 *
 * Two ways in, because the two audiences are different: somebody who already keeps decks here picks
 * one, and somebody arriving with an `.apkg` can convert it without importing it first. The second
 * path stores nothing — the file is parsed, converted and handed straight back.
 */
export default function ExportPage() {
  const t = useT();
  const [source, setSource] = useState<"deck" | "upload">("deck");

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-ink">{t("export.heading")}</h1>
        <p className="text-sm text-muted">{t("export.lede")}</p>
      </header>

      <div
        role="tablist"
        aria-label={t("export.sourceTablist")}
        className="flex gap-2 border-b border-line"
      >
        <Tab active={source === "deck"} onClick={() => setSource("deck")}>
          {t("export.fromDeck")}
        </Tab>
        <Tab active={source === "upload"} onClick={() => setSource("upload")}>
          {t("export.fromUpload")}
        </Tab>
      </div>

      {source === "deck" ? <FromDeck /> : <FromUpload />}
    </div>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`focus-ring -mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${
        active
          ? "border-accent text-ink"
          : "border-transparent text-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

// ── pick one of your decks ───────────────────────────────────────────────────

function FromDeck() {
  const t = useT();
  const decks = useDecks();
  const [deckId, setDeckId] = useState("");
  const preview = useMcqExportPreview(deckId, deckId !== "");
  const download = useExportMcqApkg(deckId);

  const options = useMemo(
    () =>
      (decks.data ?? []).map((d) => ({
        value: d.id,
        label: `${d.name} · ${d.cardCount} cards`,
      })),
    [decks.data],
  );

  const chosen = (decks.data ?? []).find((d) => d.id === deckId);
  const nothingToExport = preview.data?.exportedCards === 0;

  if (decks.isLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted">
        <Spinner className="h-4 w-4" /> Loading your decks…
      </p>
    );
  }

  if ((decks.data ?? []).length === 0) {
    return (
      <p className="rounded-card border border-line bg-surface p-4 text-sm text-muted">
        {t("export.noDecks")}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <span className="block text-sm font-medium text-ink" id="deck-picker-label">
          {t("export.deck")}
        </span>
        <Select
          value={deckId}
          onChange={setDeckId}
          ariaLabelledBy="deck-picker-label"
          placeholder={t("export.chooseDeck")}
          options={options}
          fullWidth
        />
      </div>

      {deckId !== "" && (
        <ReportPanel
          loading={preview.isLoading}
          error={preview.isError}
          report={preview.data}
        />
      )}

      <DownloadButton
        disabled={deckId === "" || preview.isLoading || nothingToExport}
        pending={download.isPending}
        onClick={() => download.mutate(`${chosen?.name ?? "deck"}-mcq.apkg`)}
      />

      {download.isError && <ErrorLine />}
    </div>
  );
}

// ── or bring your own file ───────────────────────────────────────────────────

function FromUpload() {
  const t = useT();
  const [file, setFile] = useState<File | null>(null);
  const convert = useExportMcqFromUpload();

  return (
    <div className="space-y-4">
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-card border border-dashed border-line-strong bg-surface p-6 text-center transition hover:border-accent">
        <Icon name="upload" size={22} className="text-muted" />
        <span className="text-sm font-medium text-ink">
          {file ? file.name : t("export.chooseFile")}
        </span>
        <span className="text-xs text-muted">
          {t("export.nothingSaved")}
        </span>
        <input
          type="file"
          accept=".apkg"
          className="sr-only"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </label>

      {/* Said up front rather than discovered afterwards: the pictures live inside the uploaded
          package, and this path does not re-pack them. */}
      <p className="text-xs text-muted">
        {t("export.mediaNotCarried")}
      </p>

      <DownloadButton
        disabled={!file}
        pending={convert.isPending}
        onClick={() => file && convert.mutate(file)}
        label={t("export.convertAndDownload")}
      />

      {convert.data && (
        <p className="rounded-card border border-line bg-surface p-3 text-sm">
          {t("export.converted", {
            exported: convert.data.exported,
            total: convert.data.total,
          })}
          {convert.data.skipped > 0 && (
            <span className="text-muted">
              {" "}
              {t("export.couldNotConvert", { count: convert.data.skipped })}
            </span>
          )}
        </p>
      )}

      {convert.isError && <ErrorLine />}
    </div>
  );
}

// ── shared bits ──────────────────────────────────────────────────────────────

function ReportPanel({
  loading,
  error,
  report,
}: {
  loading: boolean;
  error: boolean;
  report?: {
    totalCards: number;
    exportedCards: number;
    skippedReasons: Record<string, number>;
  };
}) {
  // Above the early returns: a hook after a conditional return is a hooks-order violation.
  const t = useT();
  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted">
        <Spinner className="h-3.5 w-3.5" /> {t("export.checking")}
      </p>
    );
  }
  if (error) {
    return <p className="text-sm text-danger">{t("export.checkFailed")}</p>;
  }
  if (!report) return null;

  return (
    <div className="space-y-2 rounded-card border border-line bg-surface p-3 text-sm">
      {report.exportedCards > 0 ? (
        <p className="font-medium">
          {t("export.becomeQuestions", {
            exported: report.exportedCards,
            total: report.totalCards,
          })}
        </p>
      ) : (
        <p className="font-medium text-danger">{t("export.noneQuizzable")}</p>
      )}

      {/* Naming WHY, not just how many — "2 skipped" with no reason reads like a bug. */}
      {Object.entries(report.skippedReasons).length > 0 && (
        <ul className="space-y-0.5 text-xs text-muted">
          {Object.entries(report.skippedReasons).map(([reason, count]) => (
            <li key={reason}>
              {/* ⚠ `reason` is the BACKEND's own wording and the API has no locale, so this half
                  stays English until it does. Naming the reason is the point of the line —
                  "2 skipped" with none reads like a bug — so it is better English than absent. */}
              {t("export.skippedReason", { count, reason: reason.toLowerCase() })}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DownloadButton({
  disabled,
  pending,
  onClick,
  label,
}: {
  disabled: boolean;
  pending: boolean;
  onClick: () => void;
  label?: string;
}) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || pending}
      className="focus-ring inline-flex items-center gap-2 rounded-input bg-accent px-4 py-2 text-sm font-semibold text-white shadow-btn transition hover:opacity-95 disabled:opacity-60"
    >
      {pending ? <Spinner className="h-4 w-4" /> : <Icon name="download" size={16} />}
      {pending ? t("export.building") : (label ?? t("export.download"))}
    </button>
  );
}

function ErrorLine() {
  const t = useT();
  return (
    <p className="text-sm text-danger">
      {t("export.failed")}
    </p>
  );
}
