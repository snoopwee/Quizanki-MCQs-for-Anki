"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ApkgUploader } from "@/components/deck/ApkgUploader";
import { FlashcardViewer } from "@/components/deck/FlashcardViewer";
import { ApkgQuizSetup, type NoteStatsLookup } from "@/components/deck/ApkgQuizSetup";
import { QuizSession } from "@/components/quiz/QuizSession";
import { Modal } from "@/components/shared/Modal";
import { AuthModal } from "@/components/auth/AuthModal";
import { reshuffleQuestions, type Question } from "@/lib/buildQuestions";
import { parsedToImportRequest } from "@/lib/parsedToImportRequest";
import { useImportDeck } from "@/hooks/useDecks";
import { useSession } from "@/hooks/useSession";
import { useQuizStore } from "@/stores/quizStore";
import { useGuestMastery } from "@/stores/guestMasteryStore";
import type { ApkgParseResponse } from "@/types/api";

// The landing page IS the product trial: a guest can upload a deck and study /
// quiz it immediately. Logged-in users see a "Dashboard" link instead of Log in.
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
  const startSession = useQuizStore((s) => s.startSession);
  const importDeck = useImportDeck();
  // Trial mastery lives entirely client-side. Reading via getState() in the
  // lookup callback keeps `selectQuizNotes` working from current data without
  // forcing a re-render every time another card is answered.
  const guestGetStats: NoteStatsLookup = (noteId) =>
    useGuestMastery.getState().getStats(noteId);

  // Trial quiz: empty sessionId so QuizSession never records answers.
  function startTrial(parsed: ApkgParseResponse, questions: Question[]) {
    setSettingsOpen(false);
    const shuffled = reshuffleQuestions(questions);
    startSession(shuffled, "");
    setStep({ kind: "quiz", parsed, questions: shuffled });
  }

  const headerCta = loading ? (
    <span className="h-9 w-24" aria-hidden />
  ) : user ? (
    <Link
      href="/dashboard"
      className="rounded-full bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
    >
      Dashboard →
    </Link>
  ) : (
    <button
      type="button"
      onClick={() => setAuthOpen(true)}
      className="rounded-full border border-neutral-300 px-4 py-1.5 text-sm font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
    >
      Log in
    </button>
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
            className="rise flex items-center justify-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-neutral-500"
            style={{ animationDelay: "0ms" }}
          >
            <span className="inline-block h-2 w-2 rounded-[2px] bg-neutral-900 dark:bg-neutral-100" />
            Anki decks → multiple choice
          </p>
          <h1
            className="rise font-display mt-5 text-5xl font-semibold leading-[1.02] tracking-tight sm:text-6xl"
            style={{ animationDelay: "70ms" }}
          >
            Study your Anki decks{" "}
            <span className="italic text-neutral-500 dark:text-neutral-400">as quizzes.</span>
          </h1>
          <p
            className="rise mx-auto mt-6 max-w-md text-base leading-relaxed text-neutral-600 dark:text-neutral-400"
            style={{ animationDelay: "140ms" }}
          >
            Upload a <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-sm dark:bg-neutral-800">.apkg</code> file
            and start a multiple-choice quiz in seconds. No account needed — sign up later to save
            your decks and track progress.
          </p>
          <ul
            className="rise mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-neutral-500"
            style={{ animationDelay: "190ms" }}
          >
            {["Auto-detects fields", "Flashcard study mode", "Distractors from your own deck"].map(
              (f) => (
                <li key={f} className="flex items-center gap-1.5">
                  <span aria-hidden className="text-neutral-400">
                    ✓
                  </span>
                  {f}
                </li>
              ),
            )}
          </ul>

          <div className="rise mx-auto mt-10 max-w-lg text-left" style={{ animationDelay: "220ms" }}>
            <div className="rounded-3xl border border-neutral-200 bg-white/70 p-5 shadow-xl shadow-neutral-900/5 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/70">
              <ApkgUploader
                hideHeading
                onContinue={(parsed) => setStep({ kind: "flashcards", parsed })}
              />
            </div>
            <p className="mt-3 text-center text-xs text-neutral-400">
              We read the cards only — images and audio stay on your device.
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
              backLabel="Start over"
              onBack={() => setStep({ kind: "import" })}
              onStartTest={() => setStep({ kind: "setup", parsed: step.parsed })}
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
                onRetry={() => startTrial(step.parsed, step.questions)}
                onExit={() => {
                  setSettingsOpen(false);
                  setStep({ kind: "setup", parsed: step.parsed });
                }}
                onOpenSettings={() => setSettingsOpen(true)}
                onFinish={() => !user && setSaveOpen(true)}
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
                  description="Nice work! Create an account (or log in) to save this deck to your library and keep studying."
                  loginLabel="Log in & save"
                  signupLabel="Sign up & save"
                  onClose={() => setSaveOpen(false)}
                  onAuthed={async () => {
                    const deck = await importDeck.mutateAsync(parsedToImportRequest(step.parsed));
                    router.push(`/decks/${deck.id}`);
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
          initialMode="login"
          onClose={() => setAuthOpen(false)}
          onAuthed={() => {
            router.push(next ?? "/dashboard");
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
  const wordmarkClass = "font-display text-lg font-semibold tracking-tight";
  const wordmark = (
    <>
      Quizanki
      <span className="text-neutral-300 dark:text-neutral-600">.</span>
    </>
  );

  return (
    <div className="relative min-h-screen">
      <div aria-hidden className="landing-grid pointer-events-none absolute inset-0 -z-10" />
      <header className="sticky top-0 z-40 border-b border-neutral-200/70 bg-white/80 backdrop-blur dark:border-neutral-800/70 dark:bg-neutral-950/80">
        <div className="flex items-center justify-between px-6 py-4 sm:px-8">
          {onHome ? (
            <button type="button" onClick={onHome} className={wordmarkClass}>
              {wordmark}
            </button>
          ) : (
            <Link href="/" className={wordmarkClass}>
              {wordmark}
            </Link>
          )}
          {cta}
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
