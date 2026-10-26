"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ApkgUploader } from "@/components/deck/ApkgUploader";
import { FlashcardViewer } from "@/components/deck/FlashcardViewer";
import { ApkgQuizSetup, type NoteStatsLookup } from "@/components/deck/ApkgQuizSetup";
import { QuizSession } from "@/components/quiz/QuizSession";
import { Modal } from "@/components/shared/Modal";
import { AuthModal } from "@/components/auth/AuthModal";
import { reshuffleQuestions, type Question } from "@/lib/buildQuestions";
import { pendingDraftFromParsed } from "@/lib/deckDraft";
import { saveDraft } from "@/lib/draftStore";
import { useSession } from "@/hooks/useSession";
import { useQuizStore } from "@/stores/quizStore";
import { useGuestMastery } from "@/stores/guestMasteryStore";
import { useGuestStars } from "@/stores/guestStarStore";
import { useGuestDemo } from "@/stores/guestDemoStore";
import { buildGuestPresetQuiz, guestDemoKey, type GuestDemoSource } from "@/lib/guestDemo";
import type { ApkgParseResponse } from "@/types/api";
import { Icon } from "@/components/ui/icons";

// The landing page IS the product trial: a guest can upload a deck and study /
// quiz it immediately. Logged-in users see a "Home" link instead of Log in.
type Step =
  | { kind: "import" }
  | { kind: "flashcards"; parsed: ApkgParseResponse }
  | { kind: "setup"; parsed: ApkgParseResponse }
  | { kind: "quiz"; parsed: ApkgParseResponse; questions: Question[] };

export default function LandingPage() {
  return (
    <Suspense fallback={<Shell>{null}</Shell>}>
      <Landing />
    </Suspense>
  );
}

function Landing() {
  const router = useRouter();
  const params = useSearchParams();
  // Set when middleware redirects a logged-out user off a guarded route.
  const next = params.get("next");
  const { user, loading } = useSession();

  const [step, setStep] = useState<Step>({ kind: "import" });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(Boolean(next));
  // Which tab the auth modal opens on. A "Sign up" button that lands you on the log-in form is
  // a small betrayal of the click.
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");

  // Stash the guest's deck the moment they ASK to save it, not once authentication succeeds.
  // Four different things open this modal, so it hangs off `saveOpen` rather than being repeated
  // at each of them.
  //
  // Why it cannot wait for `onAuthed`: with email confirmation turned on, `signUp` returns no
  // session, so `onAuthed` never runs at all — the guest leaves for their inbox and the parsed
  // deck, which lives only in this component's state, dies with the tab. IndexedDB is shared
  // across tabs, so writing it here means `/import` can offer "Resume your unsaved deck?"
  // whenever they get back, however long that takes.
  useEffect(() => {
    if (!saveOpen || !("parsed" in step)) return;
    void saveDraft(pendingDraftFromParsed(step.parsed));
  }, [saveOpen, step]);

  function openAuth(mode: "login" | "signup") {
    setAuthMode(mode);
    setAuthOpen(true);
  }
  const startSession = useQuizStore((s) => s.startSession);
  // Trial stars DO subscribe (toggling one should re-render the ★ immediately),
  // unlike mastery which is read via getState() so answering a question doesn't
  // force a re-render every time.
  const guestStars = useGuestStars();
  const guestGetStats: NoteStatsLookup = (noteId) => ({
    ...useGuestMastery.getState().getStats(noteId),
    starred: guestStars.isStarred(noteId),
  });
  const guestGetStarred = (noteId: string) => guestStars.isStarred(noteId);
  const guestToggleStar = (noteId: string, next: boolean) =>
    guestStars.setStarred(noteId, next);
  const guestDemo = useGuestDemo();
  // Subscribed, not read through getState(): spending the run has to re-render the buttons.
  const guestDemoUsed = useGuestDemo((s) => s.usedByDeck);

  // Trial quiz: empty sessionId so QuizSession never records answers.
  function startTrial(parsed: ApkgParseResponse, questions: Question[]) {
    setSettingsOpen(false);
    const shuffled = reshuffleQuestions(questions);
    startSession(shuffled, "");
    setStep({ kind: "quiz", parsed, questions: shuffled });
  }

  // ── the guest demo ────────────────────────────────────────────────────────────────────────
  // One model across the whole site (2026-10-19): a guest gets open flashcards plus ONE preset
  // quiz per deck, and choosing question types / counts / fields is what an account buys. This
  // page used to hand guests the full setup screen, which made the landing trial more generous
  // than a shared deck and gave away the thing the sign-up is for.
  //
  // A signed-in user who happens to be here keeps the full setup — they already have the account.
  function demoSourceFor(parsed: ApkgParseResponse): GuestDemoSource {
    // An uploaded file has no id, so it is identified by name and size.
    return { kind: "upload", filename: parsed.filename, noteCount: parsed.totalNotes };
  }

  function demoSpent(parsed: ApkgParseResponse): boolean {
    return Object.hasOwn(guestDemoUsed, guestDemoKey(demoSourceFor(parsed)));
  }

  function startStudy(parsed: ApkgParseResponse) {
    if (user) {
      setStep({ kind: "setup", parsed });
      return;
    }
    if (demoSpent(parsed)) {
      setSaveOpen(true);
      return;
    }
    const questions = buildGuestPresetQuiz(parsed, { getStats: guestGetStats });
    if (questions.length === 0) return; // nothing askable — the flashcards still work
    guestDemo.markUsed(demoSourceFor(parsed));
    startTrial(parsed, questions);
  }

  const headerCta = loading ? (
    <span className="h-9 w-24" aria-hidden />
  ) : user ? (
    <Link
      href="/home"
      className="rounded-full bg-ink px-4 py-1.5 text-sm font-semibold text-canvas transition hover:opacity-90"
    >
      Home →
    </Link>
  ) : (
    // A visitor with no .apkg used to have exactly one link on this page, and it pointed at
    // AnkiWeb. Discover is ours and needs no file, so it belongs in the header; and "Sign up" is
    // its own button rather than something to be discovered inside the log-in modal.
    <div className="flex items-center gap-2">
      <Link
        href="/discover"
        className="hidden rounded-full px-3 py-1.5 text-sm font-semibold text-muted transition hover:text-ink sm:inline-flex"
      >
        Browse decks
      </Link>
      <button
        type="button"
        onClick={() => openAuth("login")}
        className="rounded-full border border-line-strong bg-surface px-4 py-1.5 text-sm font-semibold text-ink transition hover:border-accent hover:text-accent"
      >
        Log in
      </button>
      <button
        type="button"
        onClick={() => openAuth("signup")}
        className="rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-white shadow-btn transition hover:opacity-95"
      >
        Sign up
      </button>
    </div>
  );

  const goHome = () => {
    setSettingsOpen(false);
    setSaveOpen(false);
    setStep({ kind: "import" });
  };

  return (
    <Shell cta={headerCta} onHome={goHome}>
      {step.kind === "import" && (
        <section className="mx-auto max-w-2xl px-6 py-16 text-center lg:py-24">
          <p
            className="rise inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 font-mono text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-muted shadow-sm"
            style={{ animationDelay: "0ms" }}
          >
            <span className="inline-block h-2 w-2 rounded-[2px] bg-accent" />
            Anki decks → multiple choice
          </p>
          <h1
            className="rise font-display mt-5 text-5xl font-semibold leading-[1.02] tracking-tight sm:text-6xl"
            style={{ animationDelay: "70ms" }}
          >
            Study your Anki decks{" "}
            <span className="italic text-accent">as quizzes.</span>
          </h1>
          <p
            className="rise mx-auto mt-6 max-w-md text-base leading-relaxed text-muted"
            style={{ animationDelay: "140ms" }}
          >
            {/* This said "No account needed", which was only ever true for a deck you uploaded
                here — a shared deck was fully locked. Now the offer is the same everywhere, so
                the copy states it plainly instead of over-promising. */}
            Drop in a <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-sm text-ink">.apkg</code>{" "}
            — or open a deck someone shared — and start a multiple-choice quiz in seconds. Every
            deck gets a free quiz, no account. Sign up for unlimited runs, your own question types,
            and progress that&apos;s saved.
          </p>
          <ul
            className="rise mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-muted"
            style={{ animationDelay: "190ms" }}
          >
            {["Auto-detects fields", "Flashcard study mode", "Distractors from your own deck"].map(
              (f) => (
                <li key={f} className="flex items-center gap-1.5">
                  <span aria-hidden className="shrink-0 text-success">
                    <Icon name="check" size={15} />
                  </span>
                  {f}
                </li>
              ),
            )}
          </ul>

          <div className="rise mx-auto mt-10 max-w-lg text-left" style={{ animationDelay: "220ms" }}>
            <div className="rounded-card border border-line bg-surface/80 p-5 shadow-card backdrop-blur">
              <ApkgUploader
                hideHeading
                onContinue={(parsed) => setStep({ kind: "flashcards", parsed })}
              />
            </div>
            <p className="mt-3 text-center text-xs text-faint">
              Read every card and take one quiz free — no sign-up.
            </p>
          </div>
        </section>
      )}

      {step.kind !== "import" && (
        <div
          className={`mx-auto px-6 py-10 ${step.kind === "quiz" ? "max-w-7xl" : "max-w-2xl"}`}
        >
          {step.kind === "flashcards" && (
            <FlashcardViewer
              parsed={step.parsed}
              getStats={guestGetStats}
              getStarred={guestGetStarred}
              onToggleStar={guestToggleStar}
              backLabel="Start over"
              onBack={() => setStep({ kind: "import" })}
              onStartTest={() => startStudy(step.parsed)}
              startTestLabel={
                user
                  ? undefined // signed in: the setup screen is real, so the default label is true
                  : demoSpent(step.parsed)
                    ? "Sign up to quiz again →"
                    : "Start the free quiz →"
              }
            />
          )}

          {step.kind === "setup" && (
            <ApkgQuizSetup
              parsed={step.parsed}
              getStats={guestGetStats}
              backLabel="Back to flashcards"
              onBack={() => setStep({ kind: "flashcards", parsed: step.parsed })}
              onStart={(questions) => startTrial(step.parsed, questions)}
            />
          )}

          {step.kind === "quiz" && (
            <>
              <QuizSession
                onRetry={() => {
                  if (!user) {
                    setSaveOpen(true);
                    return;
                  }
                  startTrial(step.parsed, step.questions);
                }}
                onExit={() => {
                  setSettingsOpen(false);
                  // A guest has no setup screen to go back to — the cards are the way back.
                  setStep(
                    user
                      ? { kind: "setup", parsed: step.parsed }
                      : { kind: "flashcards", parsed: step.parsed },
                  );
                }}
                onEndTest={() => {
                  setSettingsOpen(false);
                  setStep({ kind: "flashcards", parsed: step.parsed });
                }}
                // Live settings are the customisation an account buys, so guests don't get the
                // button at all — offering it and then blocking it would be worse than its absence.
                onOpenSettings={user ? () => setSettingsOpen(true) : undefined}
                replayLocked={!user}
                onReplayLocked={() => setSaveOpen(true)}
                onFinish={() => !user && setSaveOpen(true)}
                getStats={guestGetStats}
                getStarred={guestGetStarred}
                onToggleStar={guestToggleStar}
              />
              {settingsOpen && (
                <Modal title="Quiz settings" onClose={() => setSettingsOpen(false)}>
                  <ApkgQuizSetup
                    parsed={step.parsed}
                    getStats={guestGetStats}
                    showHeading={false}
                    backLabel="Cancel"
                    startLabel="Apply"
                    onBack={() => setSettingsOpen(false)}
                    onStart={(questions) => startTrial(step.parsed, questions)}
                  />
                </Modal>
              )}
              {saveOpen && (
                <AuthModal
                  title="Save your deck"
                  description="Nice work! Create an account (or log in) to review this deck and save it to your library."
                  loginLabel="Log in & continue"
                  signupLabel="Sign up & continue"
                  // Email confirmation sends them out of the app mid-import, so this has to
                  // answer the only question they will have: "did I just lose my deck?"
                  confirmNotice="Account created, and your deck is saved in this browser. Confirm your email — check spam too — then log in and we'll pick up where you left off."
                  // Signing in with Google leaves the page, so `onAuthed` below never runs. The
                  // draft is already stashed, so this is the same destination by another route.
                  oauthNext="/import?draft=1"
                  onClose={() => setSaveOpen(false)}
                  onAuthed={async () => {
                    // Hand the parsed deck to the import review screen rather than saving it
                    // here, so a guest gets the same look-it-over-and-choose-public-or-private
                    // step every other import gets.
                    //
                    // Written again rather than trusting the effect above: this is the path that
                    // navigates away immediately, and re-stamping it costs nothing while a
                    // first write that silently failed (private mode, storage off) would cost
                    // them the deck.
                    await saveDraft(pendingDraftFromParsed(step.parsed));
                    router.push("/import?draft=1");
                    router.refresh();
                  }}
                />
              )}
            </>
          )}
        </div>
      )}

      {authOpen && (
        <AuthModal
          initialMode={authMode}
          onClose={() => setAuthOpen(false)}
          oauthNext={next ?? "/home"}
          onAuthed={() => {
            router.push(next ?? "/home");
            router.refresh();
          }}
        />
      )}
    </Shell>
  );
}

// Header + atmospheric background, shared by the page and its Suspense fallback.
function Shell({
  children,
  cta,
  onHome,
}: {
  children: React.ReactNode;
  cta?: React.ReactNode;
  // When provided, the wordmark resets the in-page flow to the start instead of
  // navigating (clicking a same-route <Link> wouldn't reset the step state).
  onHome?: () => void;
}) {
  const wordmark = (
    <span className="flex items-center gap-2">
      <span
        className="font-display grid h-7 w-7 place-items-center rounded-[9px] bg-linear-to-br from-accent to-accent-2 text-sm font-bold text-white shadow-[0_2px_10px_-2px_var(--accent-glow)]"
        aria-hidden
      >
        Q
      </span>
      <span className="font-display text-lg font-semibold tracking-tight">
        Quizanki<span className="text-accent">.</span>
      </span>
    </span>
  );

  return (
    <div className="relative min-h-screen">
      <div aria-hidden className="landing-grid pointer-events-none absolute inset-0 -z-10" />
      <header className="sticky top-0 z-40 border-b border-line bg-canvas/80 backdrop-blur">
        <div className="flex items-center justify-between px-6 py-4 sm:px-8">
          {onHome ? (
            <button type="button" onClick={onHome}>
              {wordmark}
            </button>
          ) : (
            <Link href="/">{wordmark}</Link>
          )}
          {cta}
        </div>
      </header>
      <main>{children}</main>
      <LandingFooter />
    </div>
  );
}

// The landing page had no footer at all, so the page simply ended — nothing to go to, nothing
// about what this is. Still links ONLY to routes that exist; Privacy and Terms joined the list on
// 2026-10-26, when the pages were written. Google will not let an OAuth app leave "Testing"
// without both, and the browser extension cannot be listed without the privacy policy.
function LandingFooter() {
  return (
    <footer className="mt-20 border-t border-line">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-6 py-10 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p className="text-muted">
          <span className="font-display font-semibold text-ink">
            Quizanki<span className="text-accent">.</span>
          </span>{" "}
          — your Anki decks, as multiple-choice quizzes.
        </p>
        <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-muted">
          <Link href="/discover" className="transition hover:text-ink">
            Browse decks
          </Link>
          <Link href="/privacy" className="transition hover:text-ink">
            Privacy
          </Link>
          <Link href="/terms" className="transition hover:text-ink">
            Terms
          </Link>
          <a
            href="https://ankiweb.net/shared/decks"
            target="_blank"
            rel="noopener noreferrer"
            className="transition hover:text-ink"
          >
            AnkiWeb ↗
          </a>
          <a
            href="https://apps.ankiweb.net/"
            target="_blank"
            rel="noopener noreferrer"
            className="transition hover:text-ink"
          >
            Get Anki ↗
          </a>
        </nav>
      </div>
    </footer>
  );
}
