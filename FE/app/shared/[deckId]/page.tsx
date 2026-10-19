"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSharedDeck } from "@/hooks/useDecks";
import { useSession } from "@/hooks/useSession";
import { deckContentsToParsed } from "@/lib/deckContents";
import { buildFlashcards } from "@/lib/flashcards";
import { buildGuestPresetQuiz, GUEST_DEMO_QUESTIONS } from "@/lib/guestDemo";
import { reshuffleQuestions } from "@/lib/buildQuestions";
import { useGuestMastery } from "@/stores/guestMasteryStore";
import { useGuestStars } from "@/stores/guestStarStore";
import { useGuestDemo } from "@/stores/guestDemoStore";
import { useQuizStore } from "@/stores/quizStore";
import { AuthModal } from "@/components/auth/AuthModal";
import { AppChrome } from "@/components/layout/AppChrome";
import { CardPreviewRow } from "@/components/deck/CardPreview";
import { DeckAuthor } from "@/components/deck/DeckAuthor";
import { FlashcardViewer } from "@/components/deck/FlashcardViewer";
import { QuizSession } from "@/components/quiz/QuizSession";
import { Card } from "@/components/ui/Card";
import { Icon, type IconName } from "@/components/ui/icons";
import type { NoteStatsLookup } from "@/lib/quizDeckSpecs";

// A deck someone shared. What you see depends on who you are:
//   * Signed in  → redirected to /decks/{id}, the full study experience where your own progress
//     lives (studying a shared deck is a first-class thing).
//   * Guest      → the demo, below.
//
// THE GUEST DEMO (2026-10-19). Flashcards are open and the cards are readable, because the point
// is to let somebody judge whether the deck is any good before committing to an account — and
// because the cards are served by a public, unauthenticated endpoint anyway, so the blur this
// page used to show protected nothing and could be removed from devtools in seconds. On top of
// that, one preset quiz per deck: multiple choice, auto-detected fields, no setup screen.
// CHOOSING how to study is what an account buys. Match stays signed-in only.
//
// The same rules run on the landing page for an uploaded deck, so there is one guest model.
//
// Outside the (app) route group so guests can reach it at all.

const PREVIEW_ROWS = 6;

type Step = "browse" | "flashcards" | "quiz";

export default function SharedDeckPage() {
  const { deckId } = useParams<{ deckId: string }>();
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession();

  const deckQuery = useSharedDeck(deckId);
  const [authOpen, setAuthOpen] = useState(false);
  // Why the sign-up prompt opened, so it can say something true rather than one generic line.
  const [authReason, setAuthReason] = useState<AuthReason>("study");
  const [step, setStep] = useState<Step>("browse");

  const guestMastery = useGuestMastery();
  const guestStars = useGuestStars();
  const guestDemo = useGuestDemo();
  const startStoreSession = useQuizStore((s) => s.startSession);

  const demoSource = { kind: "shared" as const, deckId };
  // Read through the store's own state so this re-renders the moment the run is spent.
  const demoUsed = useGuestDemo((s) => Object.hasOwn(s.usedByDeck, `shared:${deckId}`));

  const getStats: NoteStatsLookup = (noteId) => ({
    ...guestMastery.getStats(noteId),
    starred: guestStars.isStarred(noteId),
  });

  // Send signed-in users to the real deck page (their progress tracks there).
  useEffect(() => {
    if (!sessionLoading && user) {
      router.replace(`/decks/${deckId}`);
    }
  }, [sessionLoading, user, deckId, router]);

  const parsed = useMemo(
    () => (deckQuery.data ? deckContentsToParsed(deckQuery.data) : null),
    [deckQuery.data],
  );
  const cards = useMemo(() => (parsed ? buildFlashcards(parsed.noteTypes) : []), [parsed]);

  function promptSignUp(reason: AuthReason) {
    setAuthReason(reason);
    setAuthOpen(true);
  }

  function startDemoQuiz() {
    if (!parsed) return;
    if (demoUsed) {
      promptSignUp("again");
      return;
    }
    const questions = buildGuestPresetQuiz(parsed, { getStats });
    if (questions.length === 0) {
      // Nothing askable in this deck — say so rather than opening an empty quiz.
      promptSignUp("unquizable");
      return;
    }
    // Spent on start, not on finish: the run IS the attempt, and marking it at the end would let
    // a restart-before-finishing loop forever. Abandoning costs the run, but never the cards —
    // flashcards stay open either way.
    guestDemo.markUsed(demoSource);
    startStoreSession(reshuffleQuestions(questions), ""); // empty sessionId ⇒ guest mode
    setStep("quiz");
  }

  // While the session resolves — or once we know they're signed in and are about to redirect —
  // don't flash the guest view.
  if (sessionLoading || user) {
    return (
      <AppChrome>
        <p className="mx-auto max-w-3xl text-sm text-muted">Loading deck…</p>
      </AppChrome>
    );
  }

  if (step === "flashcards" && parsed) {
    return (
      <AppChrome>
        <div className="mx-auto max-w-3xl">
          <FlashcardViewer
            parsed={parsed}
            getStats={getStats}
            getStarred={(noteId) => guestStars.isStarred(noteId)}
            onToggleStar={(noteId, next) => guestStars.setStarred(noteId, next)}
            backLabel="Back to deck"
            onBack={() => setStep("browse")}
            onStartTest={startDemoQuiz}
            startTestLabel={demoUsed ? "Sign up to quiz again →" : "Start the free quiz →"}
          />
        </div>
        {authOpen && <SignUpPrompt reason={authReason} deckId={deckId} onClose={() => setAuthOpen(false)} />}
      </AppChrome>
    );
  }

  if (step === "quiz") {
    return (
      <AppChrome>
        <div className="mx-auto max-w-7xl">
          <QuizSession
            getStats={getStats}
            getStarred={(noteId) => guestStars.isStarred(noteId)}
            onToggleStar={(noteId, next) => guestStars.setStarred(noteId, next)}
            // The run is already spent, so every replay path is a sign-up moment.
            replayLocked
            onReplayLocked={() => promptSignUp("again")}
            onRetry={() => promptSignUp("again")}
            onExit={() => setStep("browse")}
            onEndTest={() => setStep("browse")}
            onFinish={() => promptSignUp("finished")}
          />
        </div>
        {authOpen && <SignUpPrompt reason={authReason} deckId={deckId} onClose={() => setAuthOpen(false)} />}
      </AppChrome>
    );
  }

  return (
    <AppChrome>
      <div className="mx-auto max-w-3xl space-y-6">
        {deckQuery.isLoading && <p className="text-sm text-muted">Loading deck…</p>}

        {deckQuery.isError && <NotShared />}

        {deckQuery.data && (
          <>
            {/* Accent strip as the card's own background — see `.accent-top`. */}
            <Card className="accent-top relative p-0">
              <div className="h-1.5" aria-hidden />
              <div className="p-6">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2 py-0.5 font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-accent-ink">
                  <Icon name="link" size={13} />
                  Shared deck
                </span>
                <h1
                  title={deckQuery.data.name}
                  className="font-display mt-3 line-clamp-2 break-words text-2xl font-bold tracking-tight text-ink sm:text-3xl"
                >
                  {deckQuery.data.name}
                </h1>
                <DeckAuthor
                  authorId={deckQuery.data.authorId}
                  authorName={deckQuery.data.authorName}
                  authorAvatarUrl={deckQuery.data.authorAvatarUrl}
                  sourceAuthorName={deckQuery.data.sourceAuthorName}
                  variant="detailed"
                  createdAt={deckQuery.data.importedAt}
                  className="mt-3"
                />
                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <Icon name="layers" size={15} />
                    {cards.length} card{cards.length === 1 ? "" : "s"}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Icon name="cards" size={15} />
                    {deckQuery.data.noteTypes.length} note type
                    {deckQuery.data.noteTypes.length === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
            </Card>

            {/* study modes */}
            <div>
              <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-[0.06em] text-muted">
                Study modes
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <ModeTile
                  primary
                  icon="clipboard"
                  label="Quiz me — Multiple choice"
                  desc={
                    demoUsed
                      ? "You've used this deck's free quiz — sign up to keep going"
                      : `Free quiz: ${Math.min(GUEST_DEMO_QUESTIONS, cards.length)} questions, no account needed`
                  }
                  locked={demoUsed}
                  onClick={startDemoQuiz}
                />
                <ModeTile
                  icon="cards"
                  color="var(--info)"
                  label="Flashcards"
                  desc="Flip through every card — free, no account"
                  onClick={() => setStep("flashcards")}
                />
                <ModeTile
                  icon="shuffle"
                  color="var(--success)"
                  label="Match"
                  desc="Sign up to race the pairing game"
                  locked
                  onClick={() => promptSignUp("match")}
                />
              </div>
              {demoUsed && (
                <p className="mt-3 text-xs leading-relaxed text-muted">
                  Free quizzes are one per deck. An account gives you unlimited runs, your own
                  question types and card counts, saved progress, and Match.{" "}
                  <button
                    type="button"
                    onClick={() => promptSignUp("again")}
                    className="focus-ring font-semibold text-accent-ink underline underline-offset-2"
                  >
                    Create one free
                  </button>
                </p>
              )}
            </div>

            {/* cards — readable. The whole point of the preview is judging the deck. */}
            <div>
              <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-[0.06em] text-muted">
                Cards in this deck
              </p>
              <ul className="space-y-2">
                {cards.slice(0, PREVIEW_ROWS).map((c, i) => (
                  <CardPreviewRow key={`${c.id}#${i}`} front={c.front} back={c.back} />
                ))}
              </ul>
              {cards.length > PREVIEW_ROWS && (
                <button
                  type="button"
                  onClick={() => setStep("flashcards")}
                  className="focus-ring mt-3 text-sm font-medium text-accent-ink underline underline-offset-2"
                >
                  See all {cards.length} cards in flashcards →
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {authOpen && <SignUpPrompt reason={authReason} deckId={deckId} onClose={() => setAuthOpen(false)} />}
    </AppChrome>
  );
}

// Why we're asking. A prompt that names the thing the learner just tried to do converts better
// than one generic "sign in to continue", and costs nothing but a string.
type AuthReason = "study" | "again" | "finished" | "match" | "unquizable";

const REASONS: Record<AuthReason, { title: string; description: string }> = {
  study: {
    title: "Study this deck",
    description: "Create a free account (or log in) to study this deck and keep your progress.",
  },
  again: {
    title: "Keep going on this deck",
    description:
      "Free quizzes are one per deck. With an account you get unlimited runs, your own question types and card counts, and progress that's saved.",
  },
  finished: {
    title: "Nice work — keep this progress",
    description:
      "Your score for this run isn't saved yet. Create a free account to keep it, study this deck again, and choose how you're quizzed.",
  },
  match: {
    title: "Play Match",
    description: "Match is for signed-in learners. Creating an account is free and takes a moment.",
  },
  unquizable: {
    title: "This deck can't be quizzed",
    description:
      "Its cards don't have a question and answer pair we can build questions from. You can still read them in flashcards, or sign up to bring your own deck.",
  },
};

function SignUpPrompt({
  reason,
  deckId,
  onClose,
}: {
  reason: AuthReason;
  deckId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const { title, description } = REASONS[reason];
  return (
    <AuthModal
      title={title}
      description={description}
      loginLabel="Log in"
      signupLabel="Sign up"
      initialMode="signup"
      onClose={onClose}
      onAuthed={() => {
        // Now signed in — the real deck page takes over (progress + all modes).
        router.push(`/decks/${deckId}`);
        router.refresh();
      }}
    />
  );
}

// A study-mode tile. `locked` only changes how it LOOKS — the click handler decides what happens,
// because a locked tile still needs to open the sign-up prompt rather than do nothing.
function ModeTile({
  icon,
  label,
  desc,
  color = "var(--accent)",
  primary = false,
  locked = false,
  onClick,
}: {
  icon: IconName;
  label: string;
  desc: string;
  color?: string;
  primary?: boolean;
  locked?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex items-center gap-3.5 rounded-card border p-4 text-left transition ${
        primary && !locked
          ? "border-transparent bg-accent shadow-btn hover:opacity-95"
          : "border-line bg-surface hover:-translate-y-0.5 hover:border-line-strong"
      }`}
    >
      <span
        className="grid h-10 w-10 shrink-0 place-items-center rounded-input"
        style={
          primary && !locked
            ? { background: "rgba(255,255,255,0.16)", color: "#fff" }
            : { background: `color-mix(in oklab, ${color} 16%, transparent)`, color }
        }
      >
        <Icon name={icon} size={21} />
      </span>
      <span className="min-w-0">
        <span
          className={`flex items-center gap-2 text-sm font-bold ${
            primary && !locked ? "text-white" : "text-ink"
          }`}
        >
          {label}
        </span>
        <span
          className={`mt-0.5 block text-xs ${primary && !locked ? "text-white/80" : "text-muted"}`}
        >
          {desc}
        </span>
      </span>
      <span
        className={`ml-auto shrink-0 ${primary && !locked ? "text-white/90" : "text-faint"}`}
      >
        <Icon name={locked ? "lock" : "chevronRight"} size={16} />
      </span>
    </button>
  );
}

function NotShared() {
  return (
    <Card className="p-6 text-center">
      <h1 className="font-display text-xl font-semibold tracking-tight">
        This deck isn&apos;t shared
      </h1>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
        The link may be wrong, or its owner has turned sharing off. You can still bring your own
        Anki deck and start quizzing in seconds.
      </p>
      <Link
        href="/"
        className="focus-ring mt-5 inline-flex rounded-input bg-accent px-4 py-2 text-sm font-semibold text-white shadow-btn transition hover:opacity-95"
      >
        Try Quizanki
      </Link>
    </Card>
  );
}
