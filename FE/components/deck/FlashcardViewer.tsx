"use client";

import { useEffect, useMemo, useState } from "react";
import { buildFlashcards, type Flashcard } from "@/lib/flashcards";
import { classifyMastery } from "@/lib/masteryStage";
import { CardPreviewRow, Lines, StageBadge } from "./CardPreview";
import { KebabMenu } from "@/components/shared/KebabMenu";
import { StarButton } from "@/components/shared/StarButton";
import { SpeakButton } from "@/components/shared/SpeakButton";
import { useSpeechSupported } from "@/hooks/useSpeech";
import { cancelSpeech } from "@/lib/tts";
import { EditFlashcardModal, type EditableNote } from "./EditFlashcardModal";
import { FlashcardsOptionsModal } from "./FlashcardsOptionsModal";
import { Icon } from "@/components/ui/icons";
import { Toggle } from "@/components/ui/controls";
import {
  DEFAULT_FLASHCARD_PREFS,
  loadFlashcardPreferences,
  saveFlashcardPreferences,
  type FlashcardPreferences,
} from "@/lib/flashcardPreferences";
import type { ApkgParseResponse } from "@/types/api";

// Same shape ApkgQuizSetup uses — callers can pass a single lookup that serves
// both screens.
type StatsLookup = (noteId: string) =>
  | { mastery?: number; timesSeen?: number }
  | undefined;

// A flashcard plus a stable per-position key. Cloze notes produce several cards
// that share an `id`; the key (original index) is unique, so it's what the
// shuffle order and the card-sorting piles track.
type StudyCard = Flashcard & { key: number };

const INITIAL_VISIBLE = 20;
const SHOW_MORE_STEP = 50;

// The study screen: a Quizlet/Knowt-style flashcard player (in-card speaker /
// edit / star, a bottom control bar, focus mode, shuffle + card-sorting) with a
// full preview list below. Save lives here too (via the optional onSave prop).
export function FlashcardViewer({
  parsed,
  completion,
  getStats,
  onBack,
  onStartTest,
  onSave,
  backLabel = "Import another",
  hideActions = false,
  hideHeader = false,
  editable = false,
  deckId,
  getStarred,
  onToggleStar,
}: {
  parsed: ApkgParseResponse;
  // Mean mastery across the deck (0-100). Surfaced as a percent + progress bar
  // when present; hidden for the trial flow where no server-side completion exists.
  completion?: number;
  // Per-card mastery lookup. When provided, each card surfaces a colour-coded
  // stage badge (New / Learning / Practicing / Mastered) so the learner can
  // scan progress at a glance.
  getStats?: StatsLookup;
  onBack: () => void;
  // Optional: when absent, the bottom row drops the "Set up a quiz" button.
  // Used by the auth /import flow, which keeps quiz launches on the dashboard.
  onStartTest?: () => void;
  onSave?: () => void;
  backLabel?: string;
  // When true, suppress the bottom Back/Save/Start-quiz row — the surrounding
  // page chrome (breadcrumb + action bar) handles those actions instead.
  hideActions?: boolean;
  // When true, suppress the internal title + completion block — used when the
  // page already shows a deck-header card above the viewer.
  hideHeader?: boolean;
  // When true (and deckId is set), each card gets an edit affordance to change
  // its fields. Only enabled for saved decks; the guest/import flow leaves it off.
  editable?: boolean;
  deckId?: string;
  // Star (focus) support. When both are provided, a ★ toggle appears on the
  // current card and every preview row. Keyed by the flashcard id (the note id),
  // so all clozes of one note share a star.
  getStarred?: (id: string) => boolean;
  onToggleStar?: (id: string, next: boolean) => void;
}) {
  const allCards: StudyCard[] = useMemo(
    () => buildFlashcards(parsed.noteTypes).map((c, i) => ({ ...c, key: i })),
    [parsed],
  );
  // Text-to-speech: a mount-aware support gate (the language is auto-detected per
  // card, so there's no per-deck setting to thread through).
  const speechOn = useSpeechSupported();

  const [prefs, setPrefs] = useState<FlashcardPreferences>(DEFAULT_FLASHCARD_PREFS);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [visible, setVisible] = useState(INITIAL_VISIBLE);
  const [showTop, setShowTop] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [focus, setFocus] = useState(false);
  // Reshuffle nonce — bumped whenever a fresh order is wanted.
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  // The active study subset (starred-only, or a re-study of the still-learning
  // pile). null = the whole deck.
  const [restrictKeys, setRestrictKeys] = useState<Set<number> | null>(null);
  const [subsetLabel, setSubsetLabel] = useState<string | null>(null);
  // Card-sorting piles, tracked by card key.
  const [known, setKnown] = useState<Set<number>>(() => new Set());
  const [learn, setLearn] = useState<Set<number>>(() => new Set());

  const canStar = Boolean(getStarred && onToggleStar);
  const hasStarred = useMemo(
    // getStarred is a fresh closure each render; depend on the card set + gate.
    () => (canStar ? allCards.some((c) => getStarred!(c.id)) : false),
    [allCards, canStar, getStarred],
  );

  const studyCards = useMemo(() => {
    const base = restrictKeys ? allCards.filter((c) => restrictKeys.has(c.key)) : allCards;
    return prefs.shuffle ? seededShuffle(base, seed) : base;
  }, [allCards, restrictKeys, prefs.shuffle, seed]);

  // Load saved prefs once per deck; seed the starting face from them.
  useEffect(() => {
    if (!deckId) return;
    const loaded = loadFlashcardPreferences(deckId);
    setPrefs(loaded);
    setFlipped(loaded.startSide === "back");
  }, [deckId]);

  // Derive the "starred only" subset from the pref. Snapshot the stars when it's
  // switched on (not live) — Quizlet behaves the same within a session.
  useEffect(() => {
    if (prefs.starredOnly && hasStarred) {
      const keys = new Set(allCards.filter((c) => getStarred!(c.id)).map((c) => c.key));
      setRestrictKeys(keys);
      setSubsetLabel("Starred");
    } else if (subsetLabel === "Starred") {
      setRestrictKeys(null);
      setSubsetLabel(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.starredOnly, hasStarred, allCards]);

  // Whenever the study set changes (subset / shuffle / reseed), jump to the first
  // card and clear the sorting piles (their keys belonged to the old set).
  useEffect(() => {
    setIndex(0);
    setKnown(new Set());
    setLearn(new Set());
  }, [studyCards]);

  // Landing on a new card shows the configured starting face.
  useEffect(() => {
    setFlipped(prefs.startSide === "back");
  }, [index, prefs.startSide, studyCards]);

  // Card front/back are flattened strings, so editing needs the original note:
  // its full field map, the type's field order, and the cloze flag. Keyed by the
  // persisted note UUID, which is also the flashcard id for saved decks. Cloze
  // notes map many cards to one id — editing any of them edits the shared note.
  const noteIndex = useMemo(() => {
    const map = new Map<string, EditableNote>();
    for (const nt of parsed.noteTypes) {
      for (const note of nt.notes) {
        if (!note.id) continue; // only persisted notes can be edited
        map.set(note.id, {
          noteId: note.id,
          noteType: nt.name,
          cloze: nt.cloze,
          fieldNames: nt.fieldNames,
          frontFields: nt.frontFields,
          backFields: nt.backFields,
          fields: note.fields,
        });
      }
    }
    return map;
  }, [parsed]);

  const canEdit = editable && Boolean(deckId);
  const editingNote = editingId ? noteIndex.get(editingId) : null;

  function starFor(id: string, size: "sm" | "md") {
    if (!canStar) return null;
    return (
      <StarButton
        starred={getStarred!(id)}
        size={size}
        onToggle={(next) => onToggleStar!(id, next)}
      />
    );
  }

  function updatePrefs(patch: Partial<FlashcardPreferences>) {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      if (deckId) saveFlashcardPreferences(deckId, next);
      return next;
    });
  }

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Keyboard nav: ←/A prev, →/D next, Space flip, F fullscreen, Esc leaves
  // fullscreen. Skipped when focus is in a form control or a modal is open.
  useEffect(() => {
    const lastIndex = studyCards.length - 1;
    function onKey(e: KeyboardEvent) {
      if (e.repeat || e.defaultPrevented) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (settingsOpen || editingId) return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        if (target.isContentEditable) return;
      }
      if (document.querySelector('[aria-modal="true"]')) return;

      if (e.key === "Escape" && focus) {
        e.preventDefault();
        setFocus(false);
        return;
      }
      const isPrev = e.key === "ArrowLeft" || e.key === "a" || e.key === "A";
      const isNext = e.key === "ArrowRight" || e.key === "d" || e.key === "D";
      if (isPrev) {
        e.preventDefault();
        cancelSpeech();
        setIndex((i) => Math.max(0, i - 1));
      } else if (isNext) {
        e.preventDefault();
        cancelSpeech();
        setIndex((i) => Math.min(lastIndex, i + 1));
      } else if (e.key === " ") {
        e.preventDefault();
        cancelSpeech();
        setFlipped((f) => !f);
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        setFocus((v) => !v);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [studyCards.length, focus, settingsOpen, editingId]);

  if (allCards.length === 0) {
    return (
      <div className="space-y-5">
        <h1 className="font-display text-2xl font-semibold tracking-tight">{parsed.filename}</h1>
        <p className="rounded-input border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
          We couldn&apos;t build any flashcards from this deck — its note types don&apos;t have
          readable text fields.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="rounded-input border border-line-strong bg-surface px-4 py-2 text-sm font-medium transition hover:border-accent hover:text-accent"
        >
          {backLabel}
        </button>
      </div>
    );
  }

  const total = studyCards.length;
  const safeIndex = Math.min(index, Math.max(0, total - 1));
  const card = studyCards[safeIndex];
  const cardStage = card && getStats ? classifyMastery(getStats(card.id)) : null;
  // The in-card speaker reads only the CURRENT face (front or back, whichever is
  // showing) — not the whole card.
  const faceText = card ? (flipped ? card.back : card.front).join(". ") : "";

  const sorting = prefs.cardSorting;
  const markedCount = known.size + learn.size;
  const sortingDone = sorting && total > 0 && markedCount >= total;

  function go(delta: number) {
    if (total === 0) return;
    cancelSpeech();
    setIndex((i) => Math.min(total - 1, Math.max(0, i + delta)));
  }

  function flip() {
    cancelSpeech();
    setFlipped((f) => !f);
  }

  function mark(knows: boolean) {
    if (!card) return;
    const k = card.key;
    setKnown((prev) => {
      const n = new Set(prev);
      if (knows) n.add(k);
      else n.delete(k);
      return n;
    });
    setLearn((prev) => {
      const n = new Set(prev);
      if (knows) n.delete(k);
      else n.add(k);
      return n;
    });
    cancelSpeech();
    setIndex((i) => Math.min(total - 1, i + 1));
  }

  function studySubset(keys: Set<number>, label: string) {
    // A subset overrides the starred filter; clear the pref so its effect doesn't
    // re-derive a "Starred" restriction over this one.
    if (prefs.starredOnly) updatePrefs({ starredOnly: false });
    setRestrictKeys(new Set(keys));
    setSubsetLabel(label);
    // index + piles reset by the studyCards-change effect.
  }

  function showAll() {
    if (prefs.starredOnly) updatePrefs({ starredOnly: false });
    setRestrictKeys(null);
    setSubsetLabel(null);
  }

  function restart() {
    cancelSpeech();
    setIndex(0);
    setKnown(new Set());
    setLearn(new Set());
    setFlipped(prefs.startSide === "back");
  }

  const navBtn =
    "grid h-9 w-9 place-items-center rounded-full border border-line-strong bg-surface text-ink transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-line-strong disabled:hover:text-ink";
  const iconBtn =
    "grid h-9 w-9 place-items-center rounded-full text-muted transition hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed";

  const cardHeight = focus ? "h-[58vh]" : "h-[26rem]";

  const cardBlock = card && (
    <div className="relative">
      <button
        type="button"
        onClick={flip}
        className={`flex w-full flex-col rounded-card border border-line bg-surface p-6 text-center transition hover:border-accent ${cardHeight}`}
      >
        <div className="flex shrink-0 items-center gap-3 pr-24">
          <span className="text-xs font-medium uppercase tracking-wide text-faint">
            {flipped ? "Back" : "Front"}
          </span>
          {cardStage && <StageBadge info={cardStage} />}
        </div>
        <div className="nice-scroll flex flex-1 flex-col items-center overflow-y-auto py-3">
          {/* my-auto centers content when it fits, but collapses so the top stays
              scrollable when content overflows (justify-center would clip it). */}
          <div className="my-auto w-full space-y-2">
            <Lines values={flipped ? card.back : card.front} className="text-4xl font-medium" />
          </div>
        </div>
        <span className="shrink-0 text-xs text-faint">Click to flip</span>
      </button>

      {/* in-card action cluster (Quizlet/Knowt): speaker · edit · star */}
      <div className="absolute right-3 top-3 z-10 flex items-center gap-0.5">
        {speechOn && <SpeakButton id="card-face" text={faceText} size="sm" />}
        {canEdit && noteIndex.has(card.id) && (
          <button
            type="button"
            title="Edit card"
            aria-label="Edit card"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setEditingId(card.id);
            }}
            className="focus-ring grid h-7 w-7 place-items-center rounded-full text-faint transition hover:text-accent"
          >
            <Icon name="pencil" size={15} />
          </button>
        )}
        {starFor(card.id, "sm")}
      </div>
    </div>
  );

  const sortingBreakdown = (
    <div
      className={`flex ${cardHeight} flex-col items-center justify-center gap-4 rounded-card border border-line bg-surface p-8 text-center`}
    >
      <p className="font-mono text-xs uppercase tracking-[0.08em] text-faint">Round complete</p>
      <h3 className="font-display text-2xl font-bold tracking-tight text-ink">
        You knew {known.size} of {total}
      </h3>
      <div className="flex gap-5 text-sm font-medium">
        <span className="inline-flex items-center gap-1.5 text-success">
          <Icon name="check" size={16} /> {known.size} known
        </span>
        <span className="inline-flex items-center gap-1.5 text-danger">
          <Icon name="x" size={16} /> {learn.size} still learning
        </span>
      </div>
      <div className="flex flex-wrap justify-center gap-2 pt-1">
        {learn.size > 0 && (
          <button
            type="button"
            onClick={() => studySubset(learn, "Still learning")}
            className="focus-ring rounded-input bg-accent px-4 py-2 text-sm font-semibold text-white shadow-btn transition hover:opacity-95"
          >
            Study still learning ({learn.size})
          </button>
        )}
        <button
          type="button"
          onClick={restart}
          className="rounded-input border border-line-strong bg-surface px-4 py-2 text-sm font-medium transition hover:border-accent hover:text-accent"
        >
          Restart
        </button>
        <button
          type="button"
          onClick={() => updatePrefs({ cardSorting: false })}
          className="rounded-input border border-line-strong bg-surface px-4 py-2 text-sm font-medium transition hover:border-accent hover:text-accent"
        >
          Exit sorting
        </button>
      </div>
    </div>
  );

  // The player = subset chip + (card | breakdown) + sorting buttons + control bar.
  // Rendered inline normally, or inside the focus overlay.
  const player = (
    <div className="space-y-4">
      {subsetLabel && (
        <div className="flex items-center justify-center gap-2 text-xs text-muted">
          <span>
            Studying <strong className="text-ink">{subsetLabel}</strong> · {total} card
            {total === 1 ? "" : "s"}
          </span>
          <button type="button" onClick={showAll} className="font-medium text-accent hover:underline">
            Show all
          </button>
        </div>
      )}

      {sortingDone ? sortingBreakdown : cardBlock}

      {sorting && !sortingDone && (
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => mark(false)}
            className="focus-ring flex items-center justify-center gap-2 rounded-input border border-danger/40 bg-danger/5 py-2.5 text-sm font-semibold text-danger transition hover:bg-danger/10"
          >
            <Icon name="x" size={16} /> Still learning
          </button>
          <button
            type="button"
            onClick={() => mark(true)}
            className="focus-ring flex items-center justify-center gap-2 rounded-input border border-success/40 bg-success/5 py-2.5 text-sm font-semibold text-success transition hover:bg-success/10"
          >
            <Icon name="check" size={16} /> Got it
          </button>
        </div>
      )}

      {/* bottom control bar: sorting toggle · prev/counter/next · tools.
          Wraps on phones — the nav takes its own centered row above the rest. */}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-3 border-t border-line pt-4 sm:justify-between">
        <label className="order-2 flex items-center gap-2 sm:order-1">
          <Toggle on={sorting} onChange={(v) => updatePrefs({ cardSorting: v })} />
          <span className="hidden text-xs font-medium text-muted sm:inline">Card sorting</span>
        </label>

        <div className="order-1 flex w-full items-center justify-center gap-3 sm:order-2 sm:w-auto">
          <button type="button" onClick={() => go(-1)} disabled={safeIndex === 0} className={navBtn} aria-label="Previous card">
            <Icon name="chevronLeft" size={18} />
          </button>
          <span className="min-w-[3.25rem] text-center font-mono text-sm font-bold text-ink">
            {total === 0 ? 0 : safeIndex + 1} / {total}
          </span>
          <button
            type="button"
            onClick={() => go(1)}
            disabled={safeIndex >= total - 1}
            className={navBtn}
            aria-label="Next card"
          >
            <Icon name="chevronRight" size={18} />
          </button>
        </div>

        <div className="order-3 flex items-center gap-0.5">
          <button type="button" disabled title="Autoplay — coming soon" className={`${iconBtn} opacity-40`} aria-label="Autoplay (coming soon)">
            <Icon name="play" size={15} />
          </button>
          <button
            type="button"
            onClick={() => {
              setSeed((s) => s + 1);
              updatePrefs({ shuffle: !prefs.shuffle });
            }}
            title={prefs.shuffle ? "Shuffle on" : "Shuffle"}
            aria-pressed={prefs.shuffle}
            className={
              prefs.shuffle
                ? "grid h-9 w-9 place-items-center rounded-full bg-accent-soft text-accent-ink"
                : iconBtn
            }
          >
            <Icon name="shuffle" size={17} />
          </button>
          <button type="button" onClick={() => setSettingsOpen(true)} title="Flashcards options" className={iconBtn} aria-label="Flashcards options">
            <Icon name="settings" size={17} />
          </button>
          <button
            type="button"
            onClick={() => setFocus((v) => !v)}
            title={focus ? "Exit fullscreen" : "Focus mode"}
            className={iconBtn}
            aria-label={focus ? "Exit fullscreen" : "Focus mode"}
          >
            <Icon name={focus ? "minimize" : "expand"} size={16} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      {!hideHeader && !focus && (
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{parsed.filename}</h1>
          <p className="mt-1 text-sm text-muted">
            {allCards.length} cards — study them, then set up a quiz.
          </p>
          {completion !== undefined && (
            <div className="mt-3 max-w-xs">
              <div className="flex items-center justify-between text-xs text-muted">
                <span>Deck completion</span>
                <span className="font-mono font-medium text-ink">{Math.round(completion)}%</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full bg-accent transition-[width]"
                  style={{ width: `${Math.round(completion)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {!focus && player}

      {!focus && (
        <p className="text-center text-[11px] text-faint">
          Keys: <kbd className="rounded border border-line-strong px-1">←</kbd>
          /<kbd className="rounded border border-line-strong px-1">A</kbd> prev
          · <kbd className="rounded border border-line-strong px-1">→</kbd>
          /<kbd className="rounded border border-line-strong px-1">D</kbd> next
          · <kbd className="rounded border border-line-strong px-1">Space</kbd> flip
          · <kbd className="rounded border border-line-strong px-1">F</kbd> focus
        </p>
      )}

      {!focus && !hideActions && (
        <div className="flex gap-3 border-t border-line pt-5">
          <button
            type="button"
            onClick={onBack}
            className="rounded-input border border-line-strong bg-surface px-4 py-2 text-sm font-medium transition hover:border-accent hover:text-accent"
          >
            {backLabel}
          </button>
          {onSave && (
            <button
              type="button"
              onClick={onSave}
              className="rounded-input border border-line-strong bg-surface px-4 py-2 text-sm font-medium transition hover:border-accent hover:text-accent"
            >
              Save deck
            </button>
          )}
          {onStartTest && (
            <button
              type="button"
              onClick={onStartTest}
              className="focus-ring ml-auto rounded-input bg-accent px-4 py-2 text-sm font-semibold text-white shadow-btn transition hover:opacity-95"
            >
              Set up a quiz →
            </button>
          )}
        </div>
      )}

      {/* Full preview list (Quizlet-style), rendered incrementally for big decks. */}
      {!focus && (
        <div className="space-y-3">
          <h2 className="font-mono text-xs font-medium uppercase tracking-wide text-faint">
            Cards in this deck ({total})
          </h2>
          <ul className="space-y-2">
            {studyCards.slice(0, visible).map((c) => (
              <CardPreviewRow
                key={c.key}
                front={c.front}
                back={c.back}
                stats={getStats?.(c.id)}
                action={
                  speechOn || canStar || (canEdit && noteIndex.has(c.id)) ? (
                    <div className="flex items-center gap-1">
                      {speechOn && (
                        // Reads this row's whole card (front then back), language
                        // auto-detected per segment.
                        <SpeakButton
                          id={`preview-${c.key}`}
                          text={[...c.front, ...c.back].join(". ")}
                          size="sm"
                        />
                      )}
                      {starFor(c.id, "sm")}
                      {canEdit && noteIndex.has(c.id) && (
                        <KebabMenu
                          items={[{ label: "Edit fields", onClick: () => setEditingId(c.id) }]}
                        />
                      )}
                    </div>
                  ) : undefined
                }
              />
            ))}
          </ul>

          {visible < total && (
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={() => setVisible((v) => Math.min(total, v + SHOW_MORE_STEP))}
                className="rounded-input border border-line-strong bg-surface px-4 py-2 text-sm font-medium transition hover:border-accent hover:text-accent"
              >
                Show more
              </button>
              <button
                type="button"
                onClick={() => setVisible(total)}
                className="rounded-input border border-line-strong bg-surface px-4 py-2 text-sm font-medium transition hover:border-accent hover:text-accent"
              >
                Show all ({total})
              </button>
            </div>
          )}
        </div>
      )}

      {!focus && showTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-6 right-6 z-10 rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium shadow-card transition hover:border-accent hover:text-accent"
        >
          ↑ Top
        </button>
      )}

      {/* Focus mode: a distraction-free fullscreen overlay with just the player. */}
      {focus && (
        <div className="dot-grid fixed inset-0 z-50 flex flex-col bg-canvas px-4 py-4 sm:px-8">
          <div className="mb-2 flex items-center justify-between">
            <span className="truncate font-display text-sm font-semibold text-ink">
              {parsed.filename}
            </span>
            <button
              type="button"
              onClick={() => setFocus(false)}
              title="Exit fullscreen (Esc)"
              aria-label="Exit fullscreen"
              className="grid h-9 w-9 place-items-center rounded-full border border-line bg-surface text-muted transition hover:text-ink"
            >
              <Icon name="x" size={18} />
            </button>
          </div>
          <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center">
            {player}
          </div>
        </div>
      )}

      {settingsOpen && (
        <FlashcardsOptionsModal
          prefs={prefs}
          onChange={updatePrefs}
          starredAvailable={hasStarred}
          onSave={() => setSettingsOpen(false)}
          onRestart={() => {
            restart();
            setSettingsOpen(false);
          }}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {canEdit && deckId && editingNote && (
        <EditFlashcardModal
          deckId={deckId}
          note={editingNote}
          onClose={() => setEditingId(null)}
        />
      )}
    </div>
  );
}

// Deterministic Fisher-Yates using a small seeded PRNG (mulberry32), so the
// shuffled order is stable across re-renders until the seed is bumped.
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = arr.slice();
  let s = seed >>> 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
