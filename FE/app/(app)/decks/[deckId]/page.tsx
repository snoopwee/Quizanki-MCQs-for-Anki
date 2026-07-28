"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  useCloneDeck,
  useDeckContents,
  useDeckCopies,
  useDeleteDeck,
  useOpenDeck,
  useSaveDeck,
} from "@/hooks/useDecks";
import { useNotes, useToggleStar } from "@/hooks/useNotes";
import { useStartSession } from "@/hooks/useQuizSession";
import { deckContentsToParsed } from "@/lib/deckContents";
import { reshuffleQuestions, type Question } from "@/lib/buildQuestions";
import { useQuizStore } from "@/stores/quizStore";
import { FlashcardViewer } from "@/components/deck/FlashcardViewer";
import { ApkgQuizSetup, type NoteStatsLookup } from "@/components/deck/ApkgQuizSetup";
import { DeckStatsPanel } from "@/components/deck/DeckStatsPanel";
import { KebabMenu } from "@/components/shared/KebabMenu";
import { ExportDeckModal } from "@/components/deck/ExportDeckModal";
import { ShareDeckModal } from "@/components/deck/ShareDeckModal";
import { DeckAuthor } from "@/components/deck/DeckAuthor";
import { Card } from "@/components/ui/Card";
import { Icon, type IconName } from "@/components/ui/icons";
import { SoonTag } from "@/components/ui/controls";

type Step = "flashcards" | "setup";

export default function DeckDetailPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading deck…</p>}>
      <DeckDetail />
    </Suspense>
  );
}

function DeckDetail() {
  const { deckId } = useParams<{ deckId: string }>();
  const router = useRouter();
  // `?step=setup` keeps the user on the quiz-setup screen across the round-trip
  // through the test page. Default (no param) is the flashcard browser.
  const params = useSearchParams();
  const step: Step = params.get("step") === "setup" ? "setup" : "flashcards";
  // The Stats panel's "Quiz weak cards" shortcut deep-links here with source=weak
  // so the setup screen opens straight on the still-learning slice.
  const initialSource = params.get("source") === "weak" ? "weak" : "all";

  const contentsQuery = useDeckContents(deckId);
  const notesQuery = useNotes(deckId);
  const startSession = useStartSession();
  const startQuiz = useQuizStore((s) => s.startSession);
  const deleteDeck = useDeleteDeck();
  const cloneDeck = useCloneDeck();
  const saveDeck = useSaveDeck(deckId);
  const openDeck = useOpenDeck();
  const copies = useDeckCopies(deckId).data ?? 0;
  const toggleStar = useToggleStar(deckId);

  // The viewer's relationship to this deck (from the studiable read). A non-owner
  // studying a shared deck gets the Save/Duplicate controls instead of edit/delete.
  const owned = contentsQuery.data?.owned ?? false;
  const saved = contentsQuery.data?.saved ?? false;

  // Mark the deck opened once it loads, so it shows in Home ▸ Recent. Fire-and-
  // forget; a failure (e.g. lost access) is harmless.
  const openedRef = useRef(false);
  const openMutate = openDeck.mutate;
  useEffect(() => {
    if (contentsQuery.data && !openedRef.current) {
      openedRef.current = true;
      openMutate(deckId);
    }
  }, [contentsQuery.data, deckId, openMutate]);

  function handleDuplicate() {
    cloneDeck.mutate(deckId, { onSuccess: (deck) => router.push(`/decks/${deck.id}`) });
  }

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  // Anchor for the "Flashcards" study mode — scrolls to the flashcard player.
  const cardsRef = useRef<HTMLDivElement>(null);
  const scrollToCards = () => cardsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  // Portal target for the "Cards in this deck" list. The flashcard player renders
  // right under the study modes; its card list is portaled down here, below "Your
  // progress". State-backed so the portal attaches once the slot mounts — which is
  // only after the deck finishes loading.
  const [previewSlot, setPreviewSlot] = useState<HTMLElement | null>(null);

  // Reveal the floating study-mode rail once the study-mode tiles scroll up out of
  // view, so the quiz/flashcards actions stay reachable further down the page.
  // State-backed ref (not a plain ref): the tiles mount only after the async deck
  // load, and it's the state change that re-runs the effect so the observer attaches.
  const [studyModesEl, setStudyModesEl] = useState<HTMLElement | null>(null);
  const [railVisible, setRailVisible] = useState(false);
  useEffect(() => {
    if (!studyModesEl) return;
    const obs = new IntersectionObserver(([entry]) => setRailVisible(!entry.isIntersecting));
    obs.observe(studyModesEl);
    return () => obs.disconnect();
  }, [studyModesEl]);

  // "Hide term / definition" self-test mode for the Cards-in-this-deck list, driven
  // from the floating study rail. `hideOn` gates it; `hideSide` picks the column
  // to blank ("back" = definition, the default; "front" = term).
  const [hideOn, setHideOn] = useState(false);
  const [hideSide, setHideSide] = useState<"front" | "back">("back");
  const hiddenSide = hideOn ? hideSide : null;

  const parsed = useMemo(
    () => (contentsQuery.data ? deckContentsToParsed(contentsQuery.data) : null),
    [contentsQuery.data],
  );

  // Pair each note with its server-side card_stats so selectQuizNotes can
  // weight by mastery and (per the Anki-like rule) hold new cards back until
  // some seen cards reach the ready threshold.
  const getStats: NoteStatsLookup = useMemo(() => {
    const map = new Map<string, { mastery: number; timesSeen: number; starred: boolean }>();
    for (const n of notesQuery.data ?? []) {
      const s = n.cardStats;
      map.set(n.id, {
        mastery: s?.mastery ?? 0,
        timesSeen: s?.timesSeen ?? 0,
        starred: s?.starred ?? false,
      });
    }
    return (noteId) => map.get(noteId);
  }, [notesQuery.data]);

  const getStarred = (id: string) => getStats(id)?.starred ?? false;
  const onToggleStar = (id: string, next: boolean) =>
    toggleStar.mutate({ noteId: id, starred: next });

  function goToSetup() {
    router.push(`/decks/${deckId}?step=setup`);
  }
  function goToFlashcards() {
    router.push(`/decks/${deckId}`);
  }
  function goToSetupWeak() {
    router.push(`/decks/${deckId}?step=setup&source=weak`);
  }
  function goToMatch() {
    router.push(`/decks/${deckId}/match`);
  }

  function startTest(questions: Question[]) {
    const shuffled = reshuffleQuestions(questions);
    startSession.mutate(
      { deckId, questionCount: shuffled.length, direction: "FRONT_TO_BACK" },
      {
        onSuccess: (session) => {
          startQuiz(shuffled, session.sessionId);
          router.push(`/decks/${deckId}/test`);
        },
      },
    );
  }

  function confirmDelete() {
    deleteDeck.mutate(deckId, {
      onSuccess: () => router.push("/home"),
    });
  }

  if (contentsQuery.isLoading) {
    return (
      <div className="mx-auto max-w-3xl">
        <p className="text-sm text-muted">Loading deck…</p>
      </div>
    );
  }

  if (contentsQuery.isError || !parsed || !contentsQuery.data) {
    return (
      <div className="mx-auto max-w-3xl space-y-3">
        <p className="text-sm text-muted">Deck not found.</p>
        <Link href="/home" className="text-sm font-medium text-accent hover:underline">
          Back to decks
        </Link>
      </div>
    );
  }

  const deckName = contentsQuery.data.name;
  const cardCount = contentsQuery.data.cardCount ?? 0;
  const noteTypeCount = parsed.noteTypes.length;
  const completion = contentsQuery.data.completion;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Breadcrumb
        items={[
          { label: "Home", href: "/home" },
          // When on the setup step, the deck name becomes a link back to the
          // flashcard view; on the flashcard view it's the current page (no href).
          step === "setup"
            ? { label: deckName, href: `/decks/${deckId}` }
            : { label: deckName },
          ...(step === "setup" ? [{ label: "Set up quiz" }] : []),
        ]}
      />

      {step === "flashcards" && (
        <>
          {/* deck header */}
          <Card className="relative p-0">
            {/* No overflow-hidden (it would clip the "⋯" dropdown); the accent bar
                gets a rounded top so it still fits the card's corners. */}
            <div className="h-1.5 rounded-t-card bg-accent" />
            {/* deck-options menu (Edit / Export / Delete), pinned to the top-right
                corner — the header no longer carries a separate action bar. */}
            <div className="absolute right-3 top-4">
              <KebabMenu
                label="Deck options"
                items={
                  owned
                    ? [
                        { label: "Edit flashcards", onClick: () => router.push(`/decks/${deckId}/edit`) },
                        { label: "Share deck", onClick: () => setShareOpen(true) },
                        { label: "Export deck", onClick: () => setExportOpen(true) },
                        { label: "Delete deck", onClick: () => setDeleteOpen(true), danger: true },
                      ]
                    : [
                        // Not the owner: they can keep it in their library or fork
                        // an editable copy — but never edit/delete the original.
                        {
                          label: saved ? "Remove from Home" : "Save to Home",
                          onClick: () => saveDeck.mutate(!saved),
                        },
                        { label: "Duplicate", onClick: handleDuplicate },
                      ]
                }
              />
            </div>
            <div className="p-6">
              {/* pr-10 keeps a long title clear of the corner "⋯" menu */}
              <h1 className="pr-10 font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                {deckName}
              </h1>
              <DeckAuthor
                authorId={contentsQuery.data.authorId}
                authorName={contentsQuery.data.authorName}
                authorAvatarUrl={contentsQuery.data.authorAvatarUrl}
                sourceAuthorName={contentsQuery.data.sourceAuthorName}
                variant="detailed"
                createdAt={contentsQuery.data.importedAt}
                className="mt-3"
              />
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="layers" size={15} />
                  {cardCount} card{cardCount === 1 ? "" : "s"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="cards" size={15} />
                  {noteTypeCount} note type{noteTypeCount === 1 ? "" : "s"}
                </span>
                {/* Real "N copies" now that clone provenance is tracked — this
                    replaced the old placeholder "Learners · Soon" chip. */}
                {copies > 0 && (
                  <span className="inline-flex items-center gap-1.5">
                    <Icon name="copy" size={15} />
                    {copies} cop{copies === 1 ? "y" : "ies"}
                  </span>
                )}
                {owned && contentsQuery.data.isPublic && (
                  <button
                    type="button"
                    onClick={() => setShareOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent-ink transition hover:opacity-90"
                  >
                    <Icon name="link" size={13} />
                    Shared
                  </button>
                )}
                {/* Non-owners see their library state at a glance. */}
                {!owned && saved && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent-ink">
                    <Icon name="check" size={13} />
                    Saved
                  </span>
                )}
              </div>
            </div>
          </Card>

          {/* study modes */}
          <div ref={setStudyModesEl}>
            <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-[0.06em] text-muted">
              Study modes
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <StudyMode
                primary
                icon="clipboard"
                label="Quiz me — Multiple choice"
                desc="Quizanki's signature MCQ exam with smart distractors"
                onClick={goToSetup}
              />
              <StudyMode
                icon="cards"
                color="var(--info)"
                label="Flashcards"
                desc="Flip through every card below"
                onClick={scrollToCards}
              />
              <StudyMode
                icon="shuffle"
                color="var(--success)"
                label="Match"
                desc="Race to pair terms & meanings"
                onClick={goToMatch}
              />
            </div>
          </div>

          {/* flashcard player — belongs to the study modes; sits directly beneath
              them as the "Flashcards" mode made visible. Its card LIST is portaled
              into the slot below "Your progress" (see previewSlot). */}
          <div ref={cardsRef} className="scroll-mt-6">
            <FlashcardViewer
              parsed={parsed}
              completion={contentsQuery.data.completion}
              getStats={getStats}
              getStarred={getStarred}
              onToggleStar={onToggleStar}
              hideActions
              hideHeader
              editable={owned}
              deckId={deckId}
              previewSlot={previewSlot}
              hiddenSide={hiddenSide}
              onBack={() => router.push("/home")}
              onStartTest={goToSetup}
            />
          </div>

          {/* progress: mastery ring + stat tiles + accuracy chart (below the player) */}
          <DeckStatsPanel deckId={deckId} completion={completion} onQuizWeak={goToSetupWeak} />

          {/* "Cards in this deck" list is portaled here by FlashcardViewer above. */}
          <div ref={setPreviewSlot} />

          <FloatingStudyRail
            visible={railVisible}
            onQuiz={goToSetup}
            onFlashcards={scrollToCards}
            onMatch={goToMatch}
            hideOn={hideOn}
            hideSide={hideSide}
            onToggleHide={() => setHideOn((v) => !v)}
            onSwitchSide={() => setHideSide((s) => (s === "back" ? "front" : "back"))}
          />
        </>
      )}

      {step === "setup" && (
        <ApkgQuizSetup
          parsed={parsed}
          getStats={getStats}
          deckId={deckId}
          showHeading={false}
          backLabel="Back to flashcards"
          initialSource={initialSource}
          onBack={goToFlashcards}
          onStart={startTest}
        />
      )}

      {shareOpen && (
        <ShareDeckModal
          contents={contentsQuery.data}
          onClose={() => setShareOpen(false)}
        />
      )}

      {exportOpen && (
        <ExportDeckModal
          contents={contentsQuery.data}
          onClose={() => setExportOpen(false)}
        />
      )}

      {deleteOpen && (
        <DeleteConfirm
          deckName={deckName}
          busy={deleteDeck.isPending}
          onCancel={() => setDeleteOpen(false)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}

function Breadcrumb({ items }: { items: Array<{ label: string; href?: string }> }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm">
      <ol className="flex flex-wrap items-center gap-1.5 text-muted">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={i} className="flex items-center gap-1.5">
              {item.href && !last ? (
                <Link href={item.href} className="transition-colors hover:text-accent">
                  {item.label}
                </Link>
              ) : (
                <span
                  className={last ? "font-medium text-ink" : ""}
                  aria-current={last ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}
              {!last && <span aria-hidden className="text-faint">›</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// A study-mode launcher tile (reference deck layout). `primary` paints the hero
// accent tile (Quiz me); `soon` greys + locks a not-yet-built mode.
function StudyMode({
  icon,
  label,
  desc,
  color = "var(--accent)",
  primary = false,
  soon = false,
  onClick,
}: {
  icon: IconName;
  label: string;
  desc: string;
  color?: string;
  primary?: boolean;
  soon?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={soon || !onClick}
      className={`flex items-center gap-3.5 rounded-card border p-4 text-left transition disabled:cursor-not-allowed ${
        primary
          ? "border-transparent bg-accent shadow-btn hover:opacity-95"
          : "border-line bg-surface enabled:hover:-translate-y-0.5 enabled:hover:border-line-strong"
      } ${soon ? "opacity-70" : ""}`}
    >
      <span
        className="grid h-10 w-10 shrink-0 place-items-center rounded-input"
        style={
          primary
            ? { background: "rgba(255,255,255,0.16)", color: "#fff" }
            : { background: `color-mix(in oklab, ${color} 16%, transparent)`, color }
        }
      >
        <Icon name={icon} size={21} />
      </span>
      <span className="min-w-0">
        <span
          className={`flex items-center gap-2 text-sm font-bold ${primary ? "text-white" : "text-ink"}`}
        >
          {label}
          {soon && <SoonTag />}
        </span>
        <span className={`mt-0.5 block text-xs ${primary ? "text-white/80" : "text-muted"}`}>
          {desc}
        </span>
      </span>
      <span className={`ml-auto shrink-0 ${primary ? "text-white/90" : "text-faint"}`}>
        <Icon name="chevronRight" size={16} />
      </span>
    </button>
  );
}

// A fixed, right-side floating bar of the Study-mode actions, revealed once the
// user scrolls down to the card browser so they don't have to scroll back up to
// start a quiz. Large screens only — there's gutter room beside the centered
// content; on smaller screens the study-mode tiles are only a short scroll away.
function FloatingStudyRail({
  visible,
  onQuiz,
  onFlashcards,
  onMatch,
  hideOn,
  hideSide,
  onToggleHide,
  onSwitchSide,
}: {
  visible: boolean;
  onQuiz: () => void;
  onFlashcards: () => void;
  onMatch: () => void;
  // Self-test controls: hide one column of the Cards-in-this-deck list.
  hideOn: boolean;
  hideSide: "front" | "back";
  onToggleHide: () => void;
  onSwitchSide: () => void;
}) {
  const hidingLabel = hideSide === "back" ? "definition" : "term";
  const actions: Array<{
    icon: IconName;
    label: string;
    color: string;
    primary?: boolean;
    soon?: boolean;
    onClick?: () => void;
  }> = [
    { icon: "clipboard", label: "Quiz me", color: "var(--accent)", primary: true, onClick: onQuiz },
    { icon: "cards", label: "Flashcards", color: "var(--info)", onClick: onFlashcards },
    { icon: "shuffle", label: "Match", color: "var(--success)", onClick: onMatch },
  ];
  return (
    <div
      aria-hidden={!visible}
      className={`fixed right-6 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-2 rounded-card border border-line bg-surface/90 p-2 shadow-card backdrop-blur transition-all duration-300 lg:flex ${
        visible ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-3 opacity-0"
      }`}
    >
      {actions.map((a) => (
        <div key={a.label} className="group relative flex justify-end">
          <button
            type="button"
            onClick={a.soon ? undefined : a.onClick}
            disabled={a.soon}
            aria-label={a.soon ? `${a.label} — coming soon` : a.label}
            className={`grid h-11 w-11 place-items-center rounded-full transition disabled:cursor-not-allowed ${
              a.primary
                ? "bg-accent text-white shadow-btn enabled:hover:opacity-95"
                : "border border-line bg-surface enabled:hover:border-line-strong"
            } ${a.soon ? "opacity-45" : ""}`}
            style={a.primary ? undefined : { color: a.color }}
          >
            <Icon name={a.icon} size={20} />
          </button>
          {/* label reveals to the left on hover */}
          <span className="pointer-events-none absolute right-full top-1/2 mr-2 -translate-y-1/2 whitespace-nowrap rounded-input bg-ink px-2 py-1 text-xs font-medium text-canvas opacity-0 shadow-card transition group-hover:opacity-100">
            {a.label}
            {a.soon && " · soon"}
          </span>
        </div>
      ))}

      {/* self-test: hide one column of the "Cards in this deck" list, with a switch
          for which side (term vs definition) is covered. */}
      <div className="mx-1 my-0.5 h-px bg-line" />

      <div className="group relative flex justify-end">
        <button
          type="button"
          onClick={onToggleHide}
          aria-pressed={hideOn}
          aria-label={hideOn ? "Show answers" : "Hide answers"}
          className={`grid h-11 w-11 place-items-center rounded-full border transition ${
            hideOn
              ? "border-accent bg-accent-soft text-accent-ink"
              : "border-line bg-surface text-ink hover:border-line-strong"
          }`}
        >
          <Icon name={hideOn ? "eyeOff" : "eye"} size={20} />
        </button>
        <span className="pointer-events-none absolute right-full top-1/2 mr-2 -translate-y-1/2 whitespace-nowrap rounded-input bg-ink px-2 py-1 text-xs font-medium text-canvas opacity-0 shadow-card transition group-hover:opacity-100">
          {hideOn ? "Show answers" : "Hide answers"}
        </span>
      </div>

      {hideOn && (
        <div className="group relative flex justify-end">
          <button
            type="button"
            onClick={onSwitchSide}
            aria-label={`Hiding ${hidingLabel} — switch side`}
            className="grid h-11 w-11 place-items-center rounded-full border border-line bg-surface text-[11px] font-bold uppercase tracking-tight text-ink transition hover:border-line-strong"
          >
            {hideSide === "back" ? "Def" : "Term"}
          </button>
          <span className="pointer-events-none absolute right-full top-1/2 mr-2 -translate-y-1/2 whitespace-nowrap rounded-input bg-ink px-2 py-1 text-xs font-medium text-canvas opacity-0 shadow-card transition group-hover:opacity-100">
            Hiding {hidingLabel} · tap to switch
          </span>
        </div>
      )}
    </div>
  );
}

function DeleteConfirm({
  deckName,
  busy,
  onCancel,
  onConfirm,
}: {
  deckName: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  // Lightweight inline confirmation — Modal would be overkill for one yes/no.
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm space-y-4 rounded-card border border-line bg-surface p-5 shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 className="font-display text-base font-semibold tracking-tight">Delete this deck?</h2>
          <p className="mt-1 text-sm text-muted">
            <span className="font-medium text-ink">{deckName}</span>{" "}
            and all of its progress will be removed. This can&apos;t be undone.
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-input border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium transition hover:border-accent hover:text-accent disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="focus-ring rounded-input bg-danger px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Deleting…" : "Delete deck"}
          </button>
        </div>
      </div>
    </div>
  );
}
