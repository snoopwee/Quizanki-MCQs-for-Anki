"use client";

import { Suspense, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useDeckContents, useDeleteDeck } from "@/hooks/useDecks";
import { useNotes, useToggleStar } from "@/hooks/useNotes";
import { useStartSession } from "@/hooks/useQuizSession";
import { deckContentsToParsed } from "@/lib/deckContents";
import { reshuffleQuestions, type Question } from "@/lib/buildQuestions";
import { useQuizStore } from "@/stores/quizStore";
import { FlashcardViewer } from "@/components/deck/FlashcardViewer";
import { ApkgQuizSetup, type NoteStatsLookup } from "@/components/deck/ApkgQuizSetup";
import { KebabMenu } from "@/components/shared/KebabMenu";
import { ExportDeckModal } from "@/components/deck/ExportDeckModal";
import { Card } from "@/components/ui/Card";
import { Ring } from "@/components/ui/Ring";
import { Icon, type IconName } from "@/components/ui/icons";
import { SoonTag } from "@/components/ui/controls";
import { buttonClasses } from "@/components/ui/Button";

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

  const contentsQuery = useDeckContents(deckId);
  const notesQuery = useNotes(deckId);
  const startSession = useStartSession();
  const startQuiz = useQuizStore((s) => s.startSession);
  const deleteDeck = useDeleteDeck();
  const toggleStar = useToggleStar(deckId);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  // Anchor for the "Flashcards" study mode — scrolls down to the card browser.
  const cardsRef = useRef<HTMLDivElement>(null);
  const scrollToCards = () => cardsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

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
      onSuccess: () => router.push("/dashboard"),
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
        <Link href="/dashboard" className="text-sm font-medium text-accent hover:underline">
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
          { label: "Dashboard", href: "/dashboard" },
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
          <Card className="overflow-hidden p-0">
            <div className="h-1.5 bg-accent" />
            <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-start">
              <div className="min-w-0 flex-1">
                <h1 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                  {deckName}
                </h1>
                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <Icon name="layers" size={15} />
                    {cardCount} card{cardCount === 1 ? "" : "s"}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Icon name="cards" size={15} />
                    {noteTypeCount} note type{noteTypeCount === 1 ? "" : "s"}
                  </span>
                  <span className="inline-flex items-center gap-1.5 opacity-70">
                    <Icon name="flame" size={15} />
                    Learners <SoonTag />
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-center gap-1.5 self-center sm:self-start">
                <Ring
                  value={completion / 100}
                  size={66}
                  stroke={5}
                  label={`${Math.round(completion)}%`}
                />
                <span className="font-mono text-[11px] text-faint">mastered</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-line px-6 py-4">
              <button
                type="button"
                onClick={() => router.push(`/decks/${deckId}/edit`)}
                className={buttonClasses({ variant: "ghost", size: "sm" })}
              >
                <Icon name="pencil" size={15} /> Edit
              </button>
              <button
                type="button"
                onClick={() => setExportOpen(true)}
                className={buttonClasses({ variant: "ghost", size: "sm" })}
              >
                <Icon name="upload" size={15} /> Export
              </button>
              <div className="ml-auto">
                <KebabMenu
                  label="Deck options"
                  items={[
                    { label: "Edit flashcards", onClick: () => router.push(`/decks/${deckId}/edit`) },
                    { label: "Export deck", onClick: () => setExportOpen(true) },
                    { label: "Delete deck", onClick: () => setDeleteOpen(true), danger: true },
                  ]}
                />
              </div>
            </div>
          </Card>

          {/* study modes */}
          <div>
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
                icon="brain"
                color="var(--plum)"
                label="Learn"
                desc="Adaptive spaced repetition"
                soon
              />
              <StudyMode
                icon="shuffle"
                color="var(--success)"
                label="Match"
                desc="Race to pair terms & meanings"
                soon
              />
            </div>
          </div>

          {/* card browser */}
          <div ref={cardsRef} className="scroll-mt-6">
            <FlashcardViewer
              parsed={parsed}
              completion={contentsQuery.data.completion}
              getStats={getStats}
              getStarred={getStarred}
              onToggleStar={onToggleStar}
              hideActions
              hideHeader
              editable
              deckId={deckId}
              onBack={() => router.push("/dashboard")}
              onStartTest={goToSetup}
            />
          </div>
        </>
      )}

      {step === "setup" && (
        <ApkgQuizSetup
          parsed={parsed}
          getStats={getStats}
          deckId={deckId}
          showHeading={false}
          backLabel="Back to flashcards"
          onBack={goToFlashcards}
          onStart={startTest}
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
