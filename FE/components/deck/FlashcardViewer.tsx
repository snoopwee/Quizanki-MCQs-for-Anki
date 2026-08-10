"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { buildFlashcards, type Flashcard } from "@/lib/flashcards";
import { classifyMastery, type MasteryStage } from "@/lib/masteryStage";
import { cardMatchesQuery, nextAutoplayStep } from "@/lib/flashcardStudy";
import { CardPreviewRow, Lines, StageBadge } from "./CardPreview";
import { KebabMenu } from "@/components/shared/KebabMenu";
import { StarButton } from "@/components/shared/StarButton";
import { SpeakButton } from "@/components/shared/SpeakButton";
import { useSpeechSupported } from "@/hooks/useSpeech";
import { cancelSpeech } from "@/lib/tts";
import { stripLatex } from "@/lib/displayText";
import { stripFurigana } from "@/lib/furigana";
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
import {
  clearFlashcardProgress,
  loadFlashcardProgress,
  saveFlashcardProgress,
} from "@/lib/flashcardProgress";
import { majorityFaceLang } from "@/lib/faceLanguage";
import { useSetDeckLanguages } from "@/hooks/useDecks";
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

// Mastery-stage options for the "Cards in this deck" filter (mirrors masteryStage).
const MASTERY_FILTERS: Array<{ value: MasteryStage | "all"; label: string }> = [
  { value: "all", label: "All mastery" },
  { value: "new", label: "New" },
  { value: "learning", label: "Learning" },
  { value: "practicing", label: "Practicing" },
  { value: "mastered", label: "Mastered" },
];

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
  previewSlot,
  hiddenSide = null,
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
  // When set, the "Cards in this deck" list is portaled into this element instead
  // of rendering inline under the player — lets the deck page place the player and
  // the card list in separate sections while they keep sharing all viewer state.
  previewSlot?: HTMLElement | null;
  // When "front"/"back", the matching column of every list row is blanked (tap to
  // reveal) for self-testing. Driven by the deck page's floating study rail.
  hiddenSide?: "front" | "back" | null;
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
  // The outgoing card during an advance. It stays mounted as an overlay and
  // animates away (lift + glide aside) to reveal the next card underneath — like
  // lifting a card off a stack. Plain nav flies a *blank* card (text dropped at
  // once, undistracting); card-sorting flies a coloured Know / Still-learning
  // label instead (`mark`). Cleared when the exit animation ends. `dir` picks the
  // fly-off side (1 = right, -1 = left) — sorting sends Know right, Learning left.
  const [leaving, setLeaving] = useState<
    { card: StudyCard; dir: 1 | -1; mark?: "know" | "learn" } | null
  >(null);
  // Holds the latest `go` so the keydown listener can call it without
  // re-subscribing every render.
  const goRef = useRef<(delta: number) => void>(() => {});
  // Guards the one-shot "resume where you left off" jump so it fires once per
  // mount (after piles are restored) and never fights normal paging afterwards.
  const resumedRef = useRef(false);
  // Reshuffle nonce — bumped whenever a fresh order is wanted.
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  // The active study subset (starred-only, or a re-study of the still-learning
  // pile). null = the whole deck.
  const [restrictKeys, setRestrictKeys] = useState<Set<number> | null>(null);
  const [subsetLabel, setSubsetLabel] = useState<string | null>(null);
  // Card-sorting piles, tracked by card key.
  const [known, setKnown] = useState<Set<number>>(() => new Set());
  const [learn, setLearn] = useState<Set<number>>(() => new Set());
  // "Cards in this deck" list filters (list-local; the player ignores them).
  const [search, setSearch] = useState("");
  const [masteryFilter, setMasteryFilter] = useState<MasteryStage | "all">("all");
  // Autoplay: flip → hold → advance, paced by prefs.autoplaySeconds.
  const [autoplaying, setAutoplaying] = useState(false);
  // Latest `canNext`, read by the autoplay timer — which is wired up above the
  // early-return, before canNext itself is in scope.
  const canNextRef = useRef(false);

  const canStar = Boolean(getStarred && onToggleStar);
  const hasStarred = useMemo(
    // getStarred is a fresh closure each render; depend on the card set + gate.
    () => (canStar ? allCards.some((c) => getStarred!(c.id)) : false),
    [allCards, canStar, getStarred],
  );

  // Deck-level TTS language per face. The stored deck override wins; otherwise
  // fall back to the majority language detected across the cards (so a kanji deck
  // defaults to Japanese, not Chinese). A per-card override beats both at speak
  // time. Editing the deck default persists via PUT /decks/{id}/languages.
  const setDeckLanguages = useSetDeckLanguages(deckId ?? "");
  const autoTermLang = useMemo(() => majorityFaceLang(allCards.map((c) => c.front)), [allCards]);
  const autoDefLang = useMemo(() => majorityFaceLang(allCards.map((c) => c.back)), [allCards]);
  const deckTermLang = parsed.frontLang ?? "";
  const deckDefLang = parsed.backLang ?? "";
  const effectiveTermLang = deckTermLang || autoTermLang;
  const effectiveDefLang = deckDefLang || autoDefLang;

  const studyCards = useMemo(() => {
    const base = restrictKeys ? allCards.filter((c) => restrictKeys.has(c.key)) : allCards;
    return prefs.shuffle ? seededShuffle(base, seed) : base;
  }, [allCards, restrictKeys, prefs.shuffle, seed]);

  // The "Cards in this deck" list applies a text search + a mastery-stage filter on
  // top of the study set (the player itself always pages the full studyCards). The
  // mastery filter is only offered when per-card stats are available (saved decks).
  const canFilterMastery = Boolean(getStats);
  const filteredCards = useMemo(() => {
    return studyCards.filter((c) => {
      if (!cardMatchesQuery(c.front, c.back, search)) return false;
      if (masteryFilter !== "all") {
        return classifyMastery(getStats?.(c.id)).stage === masteryFilter;
      }
      return true;
    });
  }, [studyCards, search, masteryFilter, getStats]);
  const listFiltering = search.trim() !== "" || masteryFilter !== "all";

  // Load saved prefs once per deck; seed the starting face from them. Also restore
  // any in-progress card-sorting piles so navigating away and back resumes the
  // round instead of wiping it. Keys are order-independent, so this survives
  // shuffle / subset views; the resume-position effect below jumps to the first
  // still-unsorted card. Stale keys (deck shrank since the save) are filtered out
  // so markedCount can't overshoot the deck size.
  useEffect(() => {
    if (!deckId) return;
    const loaded = loadFlashcardPreferences(deckId);
    setPrefs(loaded);
    setFlipped(loaded.startSide === "back");
    const validKeys = new Set(allCards.map((c) => c.key));
    const prog = loadFlashcardProgress(deckId);
    setKnown(new Set(prog.known.filter((k) => validKeys.has(k))));
    setLearn(new Set(prog.learn.filter((k) => validKeys.has(k))));
    // allCards is only used to prune stale keys on this one-shot restore; we don't
    // want a later deck-content change to re-run (and clobber) the restore.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  // card. The sorting piles are NOT cleared here — they're keyed by card, so they
  // stay valid across reorderings, and the new-round actions (shuffle, starred,
  // subset, restart) reset them explicitly. Clearing here would also wipe the
  // piles we restore on mount before the resume effect can use them.
  useEffect(() => {
    setIndex(0);
    setLeaving(null);
  }, [studyCards]);

  // Resume: after piles are restored on mount, jump to the first card that isn't
  // sorted yet (in the current order) rather than card 1. One-shot per mount (the
  // ref guard) so it can't fight normal paging once marking resumes.
  useEffect(() => {
    if (resumedRef.current || !prefs.cardSorting) return;
    if (known.size === 0 && learn.size === 0) return;
    resumedRef.current = true;
    const sorted = new Set<number>([...known, ...learn]);
    const next = studyCards.findIndex((c) => !sorted.has(c.key));
    setIndex(next === -1 ? 0 : next);
  }, [prefs.cardSorting, known, learn, studyCards]);

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
          frontLang: note.frontLang ?? null,
          backLang: note.backLang ?? null,
          frontImageUrl: note.frontImageUrl ?? null,
          backImageUrl: note.backImageUrl ?? null,
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

  // Drop the card-sorting piles + their persisted copy — used by every action
  // that starts a fresh round (new order, new subset, or an explicit restart).
  function resetSortProgress() {
    setKnown(new Set());
    setLearn(new Set());
    if (deckId) clearFlashcardProgress(deckId);
  }

  function updatePrefs(patch: Partial<FlashcardPreferences>) {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    if (deckId) saveFlashcardPreferences(deckId, next);
    // Card sorting swaps the nav controls for Know / Still-learning verdicts, which
    // autoplay can't drive — so turn autoplay off when sorting turns on.
    if (next.cardSorting && !prefs.cardSorting) setAutoplaying(false);
    // Changing which cards / what order you study starts a fresh sorting round,
    // so the old Know / Still-learning piles no longer apply. (Toggling sorting
    // itself, or the starting side, keeps the piles.)
    if (next.shuffle !== prefs.shuffle || next.starredOnly !== prefs.starredOnly) {
      resetSortProgress();
    }
  }

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Keyboard nav: ←/A prev, →/D next, Space flip, F fullscreen, Esc leaves
  // fullscreen. Skipped when focus is in a form control or a modal is open.
  useEffect(() => {
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
        setAutoplaying(false);
        goRef.current(-1);
      } else if (isNext) {
        e.preventDefault();
        setAutoplaying(false);
        goRef.current(1);
      } else if (e.key === " ") {
        e.preventDefault();
        setAutoplaying(false);
        cancelSpeech();
        setFlipped((f) => !f);
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        setFocus((v) => !v);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [focus, settingsOpen, editingId]);

  // Narrowing the list starts it from the top again rather than deep in a
  // "show more" page.
  useEffect(() => {
    setVisible(INITIAL_VISIBLE);
  }, [search, masteryFilter]);

  // Autoplay driver: schedule one tick after the configured delay. On the start
  // face it flips to reveal the other side; once shown, it advances (or stops at
  // the last card). `flipped` flips on every tick, so re-running on it keeps the
  // timer chained; a manual flip or nav clears `autoplaying`, ending the loop.
  useEffect(() => {
    if (!autoplaying) return;
    const delay = Math.max(1, prefs.autoplaySeconds) * 1000;
    const t = setTimeout(() => {
      const onStartSide = flipped === (prefs.startSide === "back");
      const step = nextAutoplayStep(onStartSide, canNextRef.current);
      if (step === "flip") {
        cancelSpeech();
        setFlipped((f) => !f);
      } else if (step === "advance") {
        goRef.current(1);
      } else {
        setAutoplaying(false);
      }
    }, delay);
    return () => clearTimeout(t);
  }, [autoplaying, flipped, prefs.autoplaySeconds, prefs.startSide]);

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
  // Per-face TTS text + language (per-card override → deck default → auto ""), so
  // each face carries its own speaker reading that side in the right voice.
  const frontText = card ? stripFurigana(stripLatex(card.front.join(". "))) : "";
  const backText = card ? stripFurigana(stripLatex(card.back.join(". "))) : "";
  const frontFaceLang = card ? card.frontLang || effectiveTermLang : "";
  const backFaceLang = card ? card.backLang || effectiveDefLang : "";

  const sorting = prefs.cardSorting;
  const markedCount = known.size + learn.size;
  const sortingDone = sorting && total > 0 && markedCount >= total;

  const canPrev = safeIndex > 0;
  const canNext = safeIndex < total - 1;

  function go(delta: number) {
    if (total === 0 || !card) return;
    // Nothing to reveal past the ends — don't fling the card into empty space.
    if (delta > 0 ? !canNext : !canPrev) return;
    cancelSpeech();
    // Fly the outgoing card away as a blank surface — its text vanishes at once,
    // so only the reveal of the next card (already rendered beneath) draws the eye.
    setLeaving({ card, dir: delta >= 0 ? 1 : -1 });
    // Reset the flip synchronously so the revealed next card shows its start face.
    setFlipped(prefs.startSide === "back");
    setIndex((i) => Math.min(total - 1, Math.max(0, i + delta)));
  }
  goRef.current = go;

  function flip() {
    // A manual flip takes over — stop autoplay so the two don't fight.
    setAutoplaying(false);
    cancelSpeech();
    setFlipped((f) => !f);
  }

  // Keep the autoplay timer's view of "is there a next card" current.
  canNextRef.current = canNext;

  function mark(knows: boolean) {
    if (!card) return;
    const k = card.key;
    // Whether this fills the last unsorted slot — if so the breakdown replaces
    // the card, so skip the fly-away (its overlay wouldn't mount to clear itself).
    const already = known.has(k) || learn.has(k);
    const willComplete = (already ? markedCount : markedCount + 1) >= total;
    const nextKnown = new Set(known);
    const nextLearn = new Set(learn);
    if (knows) {
      nextKnown.add(k);
      nextLearn.delete(k);
    } else {
      nextLearn.add(k);
      nextKnown.delete(k);
    }
    setKnown(nextKnown);
    setLearn(nextLearn);
    // Persist after every mark so leaving the page mid-round resumes it later.
    if (deckId) {
      saveFlashcardProgress(deckId, { known: [...nextKnown], learn: [...nextLearn] });
    }
    cancelSpeech();
    // Fly the card off toward its pile (Know → right, Still-learning → left)
    // carrying a coloured verdict label, instead of the blank plain-nav card.
    if (!willComplete) {
      setLeaving({ card, dir: knows ? 1 : -1, mark: knows ? "know" : "learn" });
    }
    setFlipped(prefs.startSide === "back");
    setIndex((i) => Math.min(total - 1, i + 1));
  }

  function studySubset(keys: Set<number>, label: string) {
    // Snapshot the keys before resetSortProgress clears the piles they came from.
    const subset = new Set(keys);
    // A subset overrides the starred filter; clear the pref so its effect doesn't
    // re-derive a "Starred" restriction over this one.
    if (prefs.starredOnly) updatePrefs({ starredOnly: false });
    setRestrictKeys(subset);
    setSubsetLabel(label);
    // A subset is a fresh round over a filtered set — start its piles empty.
    resetSortProgress();
  }

  function showAll() {
    if (prefs.starredOnly) updatePrefs({ starredOnly: false });
    setRestrictKeys(null);
    setSubsetLabel(null);
    resetSortProgress();
  }

  function restart() {
    cancelSpeech();
    setIndex(0);
    setLeaving(null);
    resetSortProgress();
    setFlipped(prefs.startSide === "back");
  }

  const navBtn =
    "grid h-9 w-9 place-items-center rounded-full border border-line-strong bg-surface text-ink transition hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-line-strong disabled:hover:text-ink";
  const iconBtn =
    "grid h-9 w-9 place-items-center rounded-full text-muted transition hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed";
  // Card-sorting verdict buttons — same footprint as navBtn, coloured by pile.
  const learnBtn =
    "focus-ring grid h-9 w-9 place-items-center rounded-full border border-danger/40 bg-danger/5 text-danger transition hover:bg-danger/10";
  const knowBtn =
    "focus-ring grid h-9 w-9 place-items-center rounded-full border border-success/40 bg-success/5 text-success transition hover:bg-success/10";

  const cardHeight = focus ? "h-[58vh]" : "h-[26rem]";

  // A single card face. Both faces are always rendered and stacked; the flip
  // rotation reveals whichever isn't showing its (hidden) backside. The action
  // cluster (speaker · edit · star) lives ON the face, so it rotates *with* the
  // card during a flip and is readable on whichever side is up. Only the visible
  // face's cluster is interactive/announced (the hidden face is aria-hidden with
  // backface-visibility off).
  const cardFace = (side: "front" | "back") => {
    const isBack = side === "back";
    // The face currently rotated out of view. `inert` (not just aria-hidden) so its
    // cluster buttons leave the tab order and AT while the face is flipped away —
    // otherwise there'd be a focusable control inside a hidden subtree.
    const hidden = isBack ? !flipped : flipped;
    return (
      <div
        inert={hidden}
        className={`flip-face flex flex-col rounded-card border border-line bg-surface p-6 text-center transition-colors group-hover:border-accent ${
          isBack ? "flip-face-back" : ""
        }`}
      >
        <div className="flex shrink-0 items-center gap-3 pr-32">
          <span className="text-xs font-medium uppercase tracking-wide text-faint">
            {isBack ? "Back" : "Front"}
          </span>
          {cardStage && <StageBadge info={cardStage} />}
        </div>
        <div className="nice-scroll flex flex-1 flex-col items-center overflow-y-auto py-3">
          {/* my-auto centers content when it fits, but collapses so the top stays
              scrollable when content overflows (justify-center would clip it). */}
          <div className="my-auto w-full space-y-3">
            {(isBack ? card!.backImageUrl : card!.frontImageUrl) && (
              // eslint-disable-next-line @next/next/no-img-element -- arbitrary Supabase Storage host; next/image would need remotePatterns config
              <img
                src={(isBack ? card!.backImageUrl : card!.frontImageUrl) as string}
                alt=""
                className="mx-auto max-h-48 max-w-full rounded-input object-contain"
              />
            )}
            <Lines
              values={isBack ? card!.back : card!.front}
              className="text-4xl font-medium"
            />
          </div>
        </div>
        <span className="shrink-0 text-xs text-faint">Click to flip</span>

        {/* in-card action cluster (Quizlet/Knowt): speaker · edit · star. A tap on
            the cluster must not flip the card, so it stops propagation. */}
        <div
          className="absolute right-3 top-3 z-10 flex items-center gap-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          {speechOn && (
            <SpeakButton
              id={`card-face-${side}`}
              text={isBack ? backText : frontText}
              size="md"
              lang={isBack ? backFaceLang : frontFaceLang}
            />
          )}
          {canEdit && noteIndex.has(card!.id) && (
            <button
              type="button"
              title="Edit card"
              aria-label="Edit card"
              onClick={(e) => {
                e.stopPropagation();
                setEditingId(card!.id);
              }}
              className="focus-ring grid h-9 w-9 place-items-center rounded-full text-faint transition hover:text-accent"
            >
              <Icon name="pencil" size={17} />
            </button>
          )}
          {starFor(card!.id, "md")}
        </div>
      </div>
    );
  };

  // The scene is stable; the flip surface is keyed by card so it remounts (clean
  // flip reset) and the next card is present the instant we advance. The exiting
  // card is a separate overlay layered on top (see below), so this card sits
  // revealed beneath it. The flip surface is a role="button" div — not a real
  // <button> — because the action cluster lives inside it (on each face, so it
  // rotates with the card) and interactive buttons can't nest in a <button>.
  const cardBlock = card && (
    <div className={`flip-scene relative w-full ${cardHeight}`}>
      <div
        key={card.key}
        role="button"
        tabIndex={0}
        onClick={flip}
        onKeyDown={(e) => {
          // Space is handled by the global key listener; add Enter for this div
          // (it has no native button activation).
          if (e.key === "Enter") {
            e.preventDefault();
            flip();
          }
        }}
        aria-label="Flip card"
        className={`group flip-card focus-ring block h-full w-full rounded-card ${
          flipped ? "is-flipped" : ""
        }`}
      >
        {cardFace("front")}
        {cardFace("back")}
      </div>

      {/* Outgoing card: lifts off and glides away to reveal the card beneath.
          Purely decorative and non-interactive; removed when its animation ends. */}
      {leaving && (
        <div
          key={`leave-${leaving.card.key}`}
          aria-hidden
          onAnimationEnd={() => setLeaving(null)}
          className={`pointer-events-none absolute inset-0 z-30 ${
            leaving.dir >= 0 ? "fc-leave-next" : "fc-leave-prev"
          }`}
        >
          {leaving.mark ? (
            // Card-sorting: fly a coloured Know / Still-learning verdict away.
            <div
              className={`flex h-full w-full flex-col items-center justify-center gap-3 rounded-card border bg-surface shadow-card ${
                leaving.mark === "know"
                  ? "border-success/50 text-success"
                  : "border-danger/50 text-danger"
              }`}
            >
              <Icon name={leaving.mark === "know" ? "check" : "x"} size={40} />
              <span className="font-display text-2xl font-bold tracking-tight">
                {leaving.mark === "know" ? "Know" : "Still learning"}
              </span>
            </div>
          ) : (
            // Plain nav: a blank surface — text dropped at once, undistracting.
            <div className="h-full w-full rounded-card border border-line bg-surface shadow-card" />
          )}
        </div>
      )}
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

  // The player = subset chip + (card | breakdown) + control bar (which carries
  // the sort verdicts when sorting is on). Rendered inline, or in the focus overlay.
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

      {/* bottom control bar: sorting toggle · nav OR sort verdicts (✗/✓) · tools.
          Wraps on phones — the center takes its own centered row above the rest. */}
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-3 border-t border-line pt-4 sm:justify-between">
        <label className="order-2 flex items-center gap-2 sm:order-1">
          <Toggle on={sorting} onChange={(v) => updatePrefs({ cardSorting: v })} />
          <span className="hidden text-xs font-medium text-muted sm:inline">Card sorting</span>
        </label>

        <div className="order-1 flex w-full items-center justify-center gap-3 sm:order-2 sm:w-auto">
          {sorting && !sortingDone ? (
            <>
              <button
                type="button"
                onClick={() => mark(false)}
                className={learnBtn}
                aria-label="Still learning"
                title="Still learning"
              >
                <Icon name="x" size={18} />
              </button>
              <span className="min-w-[3.25rem] text-center font-mono text-sm font-bold text-ink">
                {total === 0 ? 0 : safeIndex + 1} / {total}
              </span>
              <button
                type="button"
                onClick={() => mark(true)}
                className={knowBtn}
                aria-label="Got it"
                title="Got it"
              >
                <Icon name="check" size={18} />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setAutoplaying(false);
                  go(-1);
                }}
                disabled={safeIndex === 0}
                className={navBtn}
                aria-label="Previous card"
              >
                <Icon name="chevronLeft" size={18} />
              </button>
              <span className="min-w-[3.25rem] text-center font-mono text-sm font-bold text-ink">
                {total === 0 ? 0 : safeIndex + 1} / {total}
              </span>
              <button
                type="button"
                onClick={() => {
                  setAutoplaying(false);
                  go(1);
                }}
                disabled={safeIndex >= total - 1}
                className={navBtn}
                aria-label="Next card"
              >
                <Icon name="chevronRight" size={18} />
              </button>
            </>
          )}
        </div>

        <div className="order-3 flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setAutoplaying((p) => !p)}
            disabled={sorting || total <= 1}
            title={autoplaying ? "Pause autoplay" : "Autoplay"}
            aria-label={autoplaying ? "Pause autoplay" : "Autoplay"}
            aria-pressed={autoplaying}
            className={
              autoplaying
                ? "grid h-9 w-9 place-items-center rounded-full bg-accent-soft text-accent-ink"
                : iconBtn
            }
          >
            <Icon name={autoplaying ? "pause" : "play"} size={15} />
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

  // Full preview list (Quizlet-style), rendered incrementally for big decks. Kept
  // as its own node so it can render inline OR be portaled into `previewSlot`. Above
  // the rows: a text search plus (when per-card stats exist) a mastery-stage filter.
  const previewList = (
    <div className="space-y-3">
      <h2 className="font-mono text-xs font-medium uppercase tracking-wide text-faint">
        Cards in this deck ({filteredCards.length}
        {listFiltering ? ` of ${total}` : ""})
      </h2>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint">
            <Icon name="search" size={16} />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search term or definition…"
            aria-label="Search cards"
            className="focus-ring w-full rounded-input border border-line-strong bg-surface-2 py-2 pl-9 pr-9 text-sm text-ink outline-none placeholder:text-faint"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="focus-ring absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-faint transition hover:text-ink"
            >
              <Icon name="x" size={14} />
            </button>
          )}
        </div>
        {canFilterMastery && (
          <select
            value={masteryFilter}
            onChange={(e) => setMasteryFilter(e.target.value as MasteryStage | "all")}
            aria-label="Filter by mastery"
            className="focus-ring shrink-0 rounded-input border border-line-strong bg-surface-2 px-2 py-2 text-sm text-ink outline-none"
          >
            {MASTERY_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        )}
      </div>

      {filteredCards.length === 0 ? (
        <p className="rounded-input border border-line bg-surface px-4 py-8 text-center text-sm text-muted">
          No cards match {search.trim() ? `“${search.trim()}”` : "this filter"}.
        </p>
      ) : (
        <>
          <ul className="space-y-2">
            {filteredCards.slice(0, visible).map((c) => (
              <CardPreviewRow
                key={c.key}
                front={c.front}
                back={c.back}
                frontImageUrl={c.frontImageUrl}
                backImageUrl={c.backImageUrl}
                stats={getStats?.(c.id)}
                hiddenSide={hiddenSide}
                action={
                  speechOn || canStar || (canEdit && noteIndex.has(c.id)) ? (
                    <div className="flex items-center gap-1">
                      {speechOn && (
                        // Reads this row's whole card (front then back), language
                        // auto-detected per segment.
                        <SpeakButton
                          id={`preview-${c.key}`}
                          text={stripFurigana(stripLatex([...c.front, ...c.back].join(". ")))}
                          size="sm"
                          // Whole card (front then back); hint on the term side —
                          // usually the foreign/ambiguous script — disambiguates it.
                          lang={c.frontLang || effectiveTermLang}
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

          {visible < filteredCards.length && (
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={() =>
                  setVisible((v) => Math.min(filteredCards.length, v + SHOW_MORE_STEP))
                }
                className="rounded-input border border-line-strong bg-surface px-4 py-2 text-sm font-medium transition hover:border-accent hover:text-accent"
              >
                Show more
              </button>
              <button
                type="button"
                onClick={() => setVisible(filteredCards.length)}
                className="rounded-input border border-line-strong bg-surface px-4 py-2 text-sm font-medium transition hover:border-accent hover:text-accent"
              >
                Show all ({filteredCards.length})
              </button>
            </div>
          )}
        </>
      )}
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

      {/* previewSlot undefined → render inline (import/try flows). A caller that
          opts into a slot passes the prop: null while it mounts (render nothing, so
          the list never flashes inline first), then the element → portal it there. */}
      {!focus &&
        (previewSlot === undefined
          ? previewList
          : previewSlot
            ? createPortal(previewList, previewSlot)
            : null)}

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
          language={
            deckId
              ? {
                  term: deckTermLang,
                  def: deckDefLang,
                  autoTerm: autoTermLang,
                  autoDef: autoDefLang,
                  saving: setDeckLanguages.isPending,
                  // The endpoint sets both faces at once, so send the other face's
                  // current stored value alongside the one being changed.
                  onChange: (face, code) =>
                    setDeckLanguages.mutate({
                      frontLang: face === "front" ? code : deckTermLang,
                      backLang: face === "back" ? code : deckDefLang,
                    }),
                }
              : undefined
          }
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
