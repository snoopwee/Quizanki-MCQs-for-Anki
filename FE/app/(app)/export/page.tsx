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

/**
 * Turn a deck into multiple-choice cards you answer inside Anki.
 *
 * Two ways in, because the two audiences are different: somebody who already keeps decks here picks
 * one, and somebody arriving with an `.apkg` can convert it without importing it first. The second
 * path stores nothing — the file is parsed, converted and handed straight back.
 */
export default function ExportPage() {
  const [source, setSource] = useState<"deck" | "upload">("deck");

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 sm:p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-ink">Make a quiz deck for Anki</h1>
        <p className="text-sm text-muted">
          Every card becomes a multiple-choice question, with the wrong answers drawn from the
          deck&apos;s own other cards. Anki shuffles the options on every review, and its scheduler
          does the rest — no add-on needed.
        </p>
      </header>

      <div
        role="tablist"
        aria-label="Where the deck comes from"
        className="flex gap-2 border-b border-line"
      >
        <Tab active={source === "deck"} onClick={() => setSource("deck")}>
          One of your decks
        </Tab>
        <Tab active={source === "upload"} onClick={() => setSource("upload")}>
          Upload an .apkg
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
        You don&apos;t have any decks yet. Import one first, or switch to the upload tab to convert
        an <code>.apkg</code> without saving it.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <span className="block text-sm font-medium text-ink" id="deck-picker-label">
          Deck
        </span>
        <Select
          value={deckId}
          onChange={setDeckId}
          ariaLabelledBy="deck-picker-label"
          placeholder="Choose a deck…"
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
  const [file, setFile] = useState<File | null>(null);
  const convert = useExportMcqFromUpload();

  return (
    <div className="space-y-4">
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-card border border-dashed border-line-strong bg-surface p-6 text-center transition hover:border-accent">
        <Icon name="upload" size={22} className="text-muted" />
        <span className="text-sm font-medium text-ink">
          {file ? file.name : "Choose an .apkg file"}
        </span>
        <span className="text-xs text-muted">
          Nothing is saved to your account — the file is converted and handed straight back.
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
        Pictures and audio in an uploaded deck are not carried over. Import the deck first if you
        want to keep them.
      </p>

      <DownloadButton
        disabled={!file}
        pending={convert.isPending}
        onClick={() => file && convert.mutate(file)}
        label="Convert and download"
      />

      {convert.data && (
        <p className="rounded-card border border-line bg-surface p-3 text-sm">
          Converted <strong>{convert.data.exported}</strong> of {convert.data.total} cards.
          {convert.data.skipped > 0 && (
            <span className="text-muted">
              {" "}
              {convert.data.skipped} could not become questions.
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
  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted">
        <Spinner className="h-3.5 w-3.5" /> Checking which cards can become questions…
      </p>
    );
  }
  if (error) {
    return <p className="text-sm text-danger">Could not check this deck. Try again.</p>;
  }
  if (!report) return null;

  return (
    <div className="space-y-2 rounded-card border border-line bg-surface p-3 text-sm">
      {report.exportedCards > 0 ? (
        <p className="font-medium">
          {report.exportedCards} of {report.totalCards} cards become multiple-choice questions.
        </p>
      ) : (
        <p className="font-medium text-danger">
          None of this deck&apos;s cards can become questions.
        </p>
      )}

      {/* Naming WHY, not just how many — "2 skipped" with no reason reads like a bug. */}
      {Object.entries(report.skippedReasons).length > 0 && (
        <ul className="space-y-0.5 text-xs text-muted">
          {Object.entries(report.skippedReasons).map(([reason, count]) => (
            <li key={reason}>
              {count} skipped — {reason.toLowerCase()}
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
  label = "Download quiz deck",
}: {
  disabled: boolean;
  pending: boolean;
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || pending}
      className="focus-ring inline-flex items-center gap-2 rounded-input bg-accent px-4 py-2 text-sm font-semibold text-white shadow-btn transition hover:opacity-95 disabled:opacity-60"
    >
      {pending ? <Spinner className="h-4 w-4" /> : <Icon name="download" size={16} />}
      {pending ? "Building…" : label}
    </button>
  );
}

function ErrorLine() {
  return (
    <p className="text-sm text-danger">
      That didn&apos;t work. The file may not be a valid Anki package, or the deck may be too large.
    </p>
  );
}
