"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useAiKeyStatus, useGenerateDeckFromPdf, useGenerateDeckFromText } from "@/hooks/useAi";
import {
  aiErrorKey,
  draftNotes,
  MAX_PDF_BYTES,
  pdfFileError,
  remainingCaption,
  type AiErrorText,
} from "@/lib/aiDisplay";
import { useT } from "@/components/i18n/LocaleProvider";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/icons";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { buttonClasses } from "@/components/ui/Button";
import type { AiDeckDraftResponse } from "@/types/api";
import type { MessageKey } from "@/lib/i18n/messages/en";
import type { Vars } from "@/lib/i18n/translate";

type Mode = "text" | "pdf";

const CARD_COUNTS = [20, 40, 60, 100];

// Generate a deck from the learner's own material. The cards it produces are a DRAFT: the next
// step is the same review editor an imported .apkg goes through, so nothing the model wrote
// reaches a deck unread.
export function AiGenerateImport({ onDraft }: { onDraft: (response: AiDeckDraftResponse) => void }) {
  const t = useT();
  const [mode, setMode] = useState<Mode>("text");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [deckName, setDeckName] = useState("");
  const [maxCards, setMaxCards] = useState(40);
  const [fileError, setFileError] = useState<string | null>(null);
  const [result, setResult] = useState<AiDeckDraftResponse | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const keyStatus = useAiKeyStatus();
  const usingOwnKey = keyStatus.data?.configured ?? false;
  const fromText = useGenerateDeckFromText();
  const fromPdf = useGenerateDeckFromPdf();
  const pending = fromText.isPending || fromPdf.isPending;
  const error = fromText.error ?? fromPdf.error;

  const ready = mode === "text" ? text.trim().length >= 40 : Boolean(file);

  function pickFile(picked: File | undefined) {
    setFileError(null);
    if (!picked) return;
    const problem = pdfFileError(picked);
    if (problem) {
      setFile(null);
      setFileError(t(problem.key, problem.vars));
      return;
    }
    setFile(picked);
  }

  function generate() {
    if (!ready || pending) return;
    setResult(null);
    const shared = { deckName: deckName.trim() || undefined, maxCards };
    if (mode === "text") {
      fromText.mutate({ text, ...shared }, { onSuccess: setResult });
    } else if (file) {
      fromPdf.mutate({ file, ...shared }, { onSuccess: setResult });
    }
  }

  if (result) {
    return <GeneratedSummary result={result} onContinue={() => onDraft(result)} onAgain={() => setResult(null)} />;
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-4 p-5">
        <div className="inline-flex rounded-input border border-line bg-surface-2/60 p-0.5 text-sm">
          <ModeTab label={t("aiGen.tabText")} active={mode === "text"} onClick={() => setMode("text")} />
          <ModeTab label={t("aiGen.tabPdf")} active={mode === "pdf"} onClick={() => setMode("pdf")} />
        </div>

        {mode === "text" ? (
          <div>
            <label htmlFor="ai-text" className="mb-1.5 block text-xs font-medium text-muted">
              {t("aiGen.yourNotes")}
            </label>
            <textarea
              id="ai-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={9}
              placeholder={t("aiGen.notesPlaceholder")}
              className="focus-ring w-full rounded-input border border-line-strong bg-surface p-3 text-sm text-ink"
            />
            <p className="mt-1.5 text-xs text-faint">
              {text.trim().length < 40
                ? t("aiGen.needMore")
                : t("aiGen.charCount", { count: text.trim().length.toLocaleString() })}
            </p>
          </div>
        ) : (
          <div>
            <input
              ref={fileInput}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="focus-ring flex w-full flex-col items-center gap-2 rounded-card border border-dashed border-line-strong bg-surface-2/40 px-6 py-8 text-center transition hover:border-accent/50"
            >
              <Icon name="upload" size={22} className="text-accent" />
              <span className="text-sm font-semibold text-ink">
                {file ? file.name : t("aiGen.choosePdf")}
              </span>
              <span className="text-xs text-muted">
                {file
                  ? t("aiGen.pdfChosen", { size: (file.size / 1024 / 1024).toFixed(1) })
                  : t("aiGen.pdfHint", {
                      limit: Math.round(MAX_PDF_BYTES / 1024 / 1024),
                    })}
              </span>
            </button>
            {fileError && (
              <p className="mt-2 flex items-center gap-1.5 text-sm text-danger">
                <Icon name="alertTriangle" size={14} /> {fileError}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-0 flex-1">
            <label htmlFor="ai-deck-name" className="mb-1.5 block text-xs font-medium text-muted">
              {t("aiGen.deckName")} <span className="text-faint">{t("aiGen.optional")}</span>
            </label>
            <input
              id="ai-deck-name"
              value={deckName}
              onChange={(e) => setDeckName(e.target.value)}
              placeholder={
                mode === "pdf" ? t("aiGen.fromFileName") : t("aiGen.fromFirstLine")
              }
              className="focus-ring w-full rounded-input border border-line-strong bg-surface px-3 py-2 text-sm text-ink"
            />
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted">{t("aiGen.upTo")}</p>
            <Select<number>
              value={maxCards}
              onChange={setMaxCards}
              ariaLabel={t("aiGen.maxCards")}
              options={CARD_COUNTS.map((n) => ({
                value: n,
                label: t("aiGen.cardsOption", { count: n }),
              }))}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={generate}
            disabled={!ready || pending}
            className={buttonClasses({ variant: "primary" })}
          >
            {pending ? (
              <Spinner className="h-4 w-4 text-white" label={t("aiGen.generating")} />
            ) : (
              <Icon name="bolt" size={16} />
            )}
            {pending ? t("aiGen.generating") : t("aiGen.generate")}
          </button>
          {pending && (
            <span className="text-xs text-muted">
              {t("aiGen.takesAMinute")}
            </span>
          )}
        </div>

        {error && !pending && (
          <p className="flex items-start gap-1.5 text-sm text-danger">
            <Icon name="alertTriangle" size={14} className="mt-0.5 shrink-0" />{" "}
            {errorText(aiErrorKey(error), t)}
          </p>
        )}
      </Card>

      <Disclosure usingOwnKey={usingOwnKey} />
    </div>
  );
}

// Where the material goes. Shown before generating, not buried in settings: on the shared free
// tier the provider may train on what is sent, and a learner pasting their own lecture notes
// deserves to know that before they paste.
function Disclosure({ usingOwnKey }: { usingOwnKey: boolean }) {
  const t = useT();
  return (
    <div className="flex items-start gap-2.5 rounded-card border border-line bg-surface-2/40 p-4 text-xs text-muted">
      <Icon name="eye" size={15} className="mt-0.5 shrink-0 text-info" />
      <div className="space-y-1">
        {usingOwnKey ? (
          <p>{t("aiGen.ownKeyNotice")}</p>
        ) : (
          <>
            <p>{t("aiGen.freeTierNotice")}</p>
            <p>
              {t("aiGen.dontPasteConfidential")}{" "}
              <Link href="/settings" className="font-medium text-accent hover:underline">
                {t("aiGen.addOwnKey")}
              </Link>{" "}
              {t("aiGen.toUseOwnAccount")}
            </p>
          </>
        )}
        <p>{t("aiGen.draftNotice")}</p>
      </div>
    </div>
  );
}

function GeneratedSummary({
  result,
  onContinue,
  onAgain,
}: {
  result: AiDeckDraftResponse;
  onContinue: () => void;
  onAgain: () => void;
}) {
  const t = useT();
  const notes = draftNotes(result.meta);
  const remaining = remainingCaption(result.meta.remainingToday, result.meta.keyOwner);
  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-input bg-success/12 text-success">
          <Icon name="check" size={20} />
        </span>
        <div className="min-w-0">
          <h3 className="font-display text-lg font-bold tracking-tight text-ink">
            {t("aiGen.ready", { count: result.meta.cards })}
          </h3>
          <p className="mt-0.5 text-sm text-muted">
            {result.draft.filename} · {t(remaining.key, remaining.vars)}
          </p>
        </div>
      </div>

      {notes.length > 0 && (
        <ul className="space-y-1.5">
          {notes.map((note) => (
            <li key={note} className="flex items-start gap-1.5 text-xs text-warning">
              <Icon name="alertTriangle" size={13} className="mt-0.5 shrink-0" />
              {t(note)}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onAgain} className={buttonClasses({ variant: "ghost" })}>
          {t("aiGen.startOver")}
        </button>
        <button type="button" onClick={onContinue} className={buttonClasses({ variant: "primary" })}>
          {t("aiGen.reviewCards")}
          <Icon name="chevronRight" size={16} />
        </button>
      </div>
    </Card>
  );
}

/** The API's own sentence when it sent one, our catalogue otherwise — see `aiErrorKey`. */
function errorText(e: AiErrorText, t: (key: MessageKey, vars?: Vars) => string): string {
  return "key" in e ? t(e.key) : e.text;
}

function ModeTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`focus-ring rounded-[8px] px-3 py-1.5 font-medium transition ${
        active ? "bg-surface text-ink shadow-btn" : "text-muted hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}
