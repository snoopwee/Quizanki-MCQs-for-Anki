"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ApkgUploader } from "@/components/deck/ApkgUploader";
import { DeckReviewEditor } from "@/components/deck/DeckReviewEditor";
import { Spinner } from "@/components/ui/Spinner";
import { ConfirmLeaveModal } from "@/components/shared/ConfirmLeaveModal";
import { useUnsavedGuard } from "@/hooks/useUnsavedGuard";
import { useImportContext } from "@/components/import/ImportProvider";
import { draftToImportRequest, fromParsed } from "@/lib/deckDraft";
import { draftHasPendingImages, uploadDraftImages } from "@/lib/cardImageUpload";
import { buildAudioRefs, importDeckAudio, type AudioRef } from "@/lib/cardAudioImport";
import { basicRow, type EditorState } from "@/lib/deckEditor";
import { clearDraft, describeAge, loadDraft, saveDraft } from "@/lib/draftStore";
import { parsePlainText, type ParsedPair } from "@/lib/parsePlainText";
import type { ApkgParseResponse } from "@/types/api";

// /import is "bring in a deck, look it over, then save it". Importing used to
// save the moment the parse returned — the user never saw the deck first and
// never chose how it was shared. Now a parse produces a DRAFT: they can rename
// it, fix cards, delete cards, add cards, and pick public or private, and
// nothing reaches the server until they press Save.
//
// The draft is autosaved to IndexedDB (lib/draftStore) so a crash or a closed
// laptop doesn't cost them the work, and navigating away mid-edit asks first.
type Step =
  | { kind: "import" }
  | { kind: "review" };

type Source = "file" | "text";

const AUTOSAVE_DELAY_MS = 600;

export default function ImportPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
      <ImportFlow />
    </Suspense>
  );
}

function ImportFlow() {
  const router = useRouter();
  const params = useSearchParams();
  // The landing page hands a guest's just-imported deck over after signup by
  // stashing it as a draft and sending them here.
  const wantsHandoff = params.get("draft") === "1";

  const [step, setStep] = useState<Step>({ kind: "import" });
  const [source, setSource] = useState<Source>("file");
  const [draft, setDraft] = useState<EditorState | null>(null);
  const [isPublic, setIsPublic] = useState(true); // public by default
  const [sourceFilename, setSourceFilename] = useState<string | null>(null);
  // A stored draft found on arrival, offered as "Resume?" rather than silently
  // restored — the user may well have moved on and want a clean start.
  const [recovered, setRecovered] = useState<Awaited<ReturnType<typeof loadDraft>>>(null);
  const [checkedStorage, setCheckedStorage] = useState(false);
  // Uploading imported-image data URLs to storage, just before the deck save.
  const [uploadingImages, setUploadingImages] = useState(false);
  const [imageError, setImageError] = useState(false);
  // The original .apkg + its per-note audio refs, kept so we can stream the deck's
  // audio to storage after the save (see cardAudioImport). Both cleared for a
  // text-paste import, which has no media.
  const [apkgFile, setApkgFile] = useState<File | null>(null);
  const [audioRefs, setAudioRefs] = useState<AudioRef[]>([]);
  const [importingAudio, setImportingAudio] = useState(false);

  // The save lives in AppShell's ImportProvider so its toast (and Retry)
  // survive navigation — a 5,000-card deck can take a moment to land.
  const { startImportRequest, status } = useImportContext();
  const savedRef = useRef(false);

  // Building the draft + mounting the review editor is CPU work, not a fetch, so
  // it can't be awaited — but for a large deck it's enough to feel laggy after
  // "Continue". A transition renders it off the click and lets us show a spinner
  // meanwhile, so the button never looks frozen.
  const [isPreparing, startPreparing] = useTransition();

  const dirty = step.kind === "review" && draft !== null && !savedRef.current;
  const { pendingHref, cancel } = useUnsavedGuard(dirty);

  const resume = useCallback(
    (stored: NonNullable<Awaited<ReturnType<typeof loadDraft>>>) => {
      setIsPublic(stored.isPublic);
      setSourceFilename(stored.sourceFilename);
      setRecovered(null);
      startPreparing(() => {
        setDraft(stored.state);
        setStep({ kind: "review" });
      });
    },
    [startPreparing],
  );

  // Look for an unsaved draft once on arrival. (Reading local storage into
  // state, not fetching server data — the no-useEffect-for-data rule is about
  // the latter.)
  useEffect(() => {
    let cancelled = false;
    loadDraft().then((stored) => {
      if (cancelled) return;
      setCheckedStorage(true);
      if (!stored) return;
      // A handoff from the landing page is an explicit "continue with this one".
      if (wantsHandoff) resume(stored);
      else setRecovered(stored);
    });
    return () => {
      cancelled = true;
    };
  }, [wantsHandoff, resume]);

  // Autosave, debounced so a burst of keystrokes writes once.
  useEffect(() => {
    if (!draft || savedRef.current) return;
    const timer = setTimeout(() => {
      void saveDraft({ savedAt: Date.now(), state: draft, isPublic, sourceFilename });
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [draft, isPublic, sourceFilename]);

  // `build` is deferred into the transition so both the draft construction (a big
  // .apkg is thousands of rows) and the review editor's mount happen off the click.
  function startDraft(build: () => EditorState, filename: string | null) {
    savedRef.current = false;
    setSourceFilename(filename);
    setRecovered(null);
    startPreparing(() => {
      setDraft(build());
      setStep({ kind: "review" });
    });
  }

  function handleParsed(parsed: ApkgParseResponse, file: File | null) {
    // Keep the file + audio refs for the post-save audio import; buildAudioRefs
    // returns [] when the deck has no [sound:] clips (skips the step entirely).
    setApkgFile(file);
    setAudioRefs(buildAudioRefs(parsed));
    startDraft(() => fromParsed(parsed), parsed.filename);
  }

  function handlePasted(name: string, pairs: ParsedPair[]) {
    setApkgFile(null);
    setAudioRefs([]);
    startDraft(
      () => ({
        name: name.trim() || "Untitled deck",
        rows: pairs.map((p) => basicRow(p.front, p.back)),
        layoutByType: {},
      }),
      null,
    );
  }

  async function handleSave() {
    if (!draft) return;
    setImageError(false);
    let prepared = draft;
    // Imported .apkg images arrive as data: URLs; upload them to storage first so
    // the deck saves with real URLs (not megabytes of base64).
    if (draftHasPendingImages(draft)) {
      setUploadingImages(true);
      try {
        prepared = await uploadDraftImages(draft);
        setDraft(prepared); // keep the real URLs if the deck save then fails
      } catch {
        setUploadingImages(false);
        setImageError(true);
        return;
      }
      setUploadingImages(false);
    }
    startImportRequest(draftToImportRequest(prepared, { isPublic, sourceFilename }), async (deck) => {
      // Mark saved BEFORE navigating so the leave guard doesn't challenge our
      // own redirect, and drop the local copy — it's on the server now.
      savedRef.current = true;
      void clearDraft();
      // Bring the deck's audio onto its cards by re-sending the .apkg — best-effort:
      // the deck is already saved, so a failure just means no audio (add it manually).
      if (apkgFile && audioRefs.length > 0) {
        setImportingAudio(true);
        try {
          await importDeckAudio(deck.id, apkgFile, audioRefs);
        } catch {
          // Non-fatal — leave the deck audio-less rather than blocking the redirect.
        }
        setImportingAudio(false);
      }
      router.push(`/decks/${deck.id}`);
    });
  }

  async function discard() {
    savedRef.current = true; // nothing left to protect
    await clearDraft();
    setDraft(null);
    setSourceFilename(null);
    setIsPublic(true);
    setApkgFile(null);
    setAudioRefs([]);
    setStep({ kind: "import" });
    savedRef.current = false;
  }

  const resumeAge = useMemo(
    () => (recovered ? describeAge(recovered.savedAt) : ""),
    [recovered],
  );

  return (
    <div className="mx-auto max-w-2xl">
      {step.kind === "import" && isPreparing && <PreparingPanel />}

      {step.kind === "import" && !isPreparing && (
        <div className="space-y-5">
          {checkedStorage && recovered && (
            <ResumeBanner
              name={recovered.state.name}
              cardCount={recovered.state.rows.length}
              age={resumeAge}
              onResume={() => resume(recovered)}
              onDiscard={async () => {
                await clearDraft();
                setRecovered(null);
              }}
            />
          )}

          <div className="inline-flex rounded-input border border-line bg-surface p-0.5 text-sm">
            <SourceTab label="Upload .apkg" active={source === "file"} onClick={() => setSource("file")} />
            <SourceTab label="Paste text" active={source === "text"} onClick={() => setSource("text")} />
          </div>

          {source === "file" && <ApkgUploader onContinue={handleParsed} />}
          {source === "text" && <PasteTextImport onImport={handlePasted} />}
        </div>
      )}

      {step.kind === "review" && draft && (
        <DeckReviewEditor
          draft={draft}
          isPublic={isPublic}
          saving={status === "pending" || uploadingImages || importingAudio}
          savingLabel={
            uploadingImages
              ? "Uploading images…"
              : importingAudio
                ? "Importing audio…"
                : undefined
          }
          error={status === "error"}
          imageError={imageError}
          onChange={setDraft}
          onVisibilityChange={setIsPublic}
          onSave={handleSave}
          onDiscard={discard}
        />
      )}

      {pendingHref && (
        <ConfirmLeaveModal
          onStay={cancel}
          onLeave={() => {
            savedRef.current = true; // stop the guard re-firing on our own push
            cancel();
            router.push(pendingHref);
          }}
        />
      )}
    </div>
  );
}

// Shown between "Continue" and the review editor appearing. The editor's first
// render is the slow part for a big deck, so this reassures the user it's working.
function PreparingPanel() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-line bg-surface px-6 py-14 text-center">
      <Spinner className="h-7 w-7 text-accent" />
      <p className="text-sm font-medium text-ink">Preparing your deck…</p>
      <p className="text-xs text-muted">Laying out the cards for review.</p>
    </div>
  );
}

// "Resume your unsaved deck?" — offered, not forced, because a stale draft from
// last week shouldn't hijack a fresh import.
function ResumeBanner({
  name,
  cardCount,
  age,
  onResume,
  onDiscard,
}: {
  name: string;
  cardCount: number;
  age: string;
  onResume: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-card border border-accent/30 bg-accent-soft/50 p-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">You have an unsaved deck</p>
        <p className="mt-0.5 text-xs text-muted">
          <span className="font-medium text-ink">{name || "Untitled deck"}</span> · {cardCount} card
          {cardCount === 1 ? "" : "s"} · edited {age}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={onDiscard}
          className="rounded-input border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium text-muted transition hover:border-danger hover:text-danger"
        >
          Discard
        </button>
        <button
          type="button"
          onClick={onResume}
          className="focus-ring rounded-input bg-accent px-3 py-1.5 text-sm font-semibold text-white shadow-btn transition hover:opacity-95"
        >
          Resume
        </button>
      </div>
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
          Review {pairs.length > 0 ? `${pairs.length} card${pairs.length === 1 ? "" : "s"}` : "cards"}
        </button>
      </div>
    </div>
  );
}
