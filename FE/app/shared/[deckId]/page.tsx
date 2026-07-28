"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSharedDeck } from "@/hooks/useDecks";
import { useSession } from "@/hooks/useSession";
import { deckContentsToParsed } from "@/lib/deckContents";
import { buildFlashcards } from "@/lib/flashcards";
import { AuthModal } from "@/components/auth/AuthModal";
import { AppChrome } from "@/components/layout/AppChrome";
import { CardPreviewRow } from "@/components/deck/CardPreview";
import { DeckAuthor } from "@/components/deck/DeckAuthor";
import { Card } from "@/components/ui/Card";
import { Icon, type IconName } from "@/components/ui/icons";

// A deck someone shared. What you see depends on who you are:
//   * Signed in  → redirected to /decks/{id}, the full study experience where your
//     own progress lives (studying a shared deck is a first-class thing now).
//   * Guest      → this login-walled preview: you can see what the deck is, but the
//     cards are blurred and any study mode prompts you to sign in. There's no
//     client-side trial on someone else's deck — the only no-account quiz is the
//     landing page with your OWN imported deck.
//
// Outside the (app) route group so guests can reach it at all.

const PREVIEW_ROWS = 6;

export default function SharedDeckPage() {
  const { deckId } = useParams<{ deckId: string }>();
  const router = useRouter();
  const { user, loading: sessionLoading } = useSession();

  const deckQuery = useSharedDeck(deckId);
  const [authOpen, setAuthOpen] = useState(false);

  // Send signed-in users to the real deck page (their progress tracks there).
  useEffect(() => {
    if (!sessionLoading && user) {
      router.replace(`/decks/${deckId}`);
    }
  }, [sessionLoading, user, deckId, router]);

  const cards = useMemo(
    () => (deckQuery.data ? buildFlashcards(deckContentsToParsed(deckQuery.data).noteTypes) : []),
    [deckQuery.data],
  );

  // While the session resolves — or once we know they're signed in and are about
  // to redirect — don't flash the guest wall.
  if (sessionLoading || user) {
    return (
      <AppChrome>
        <p className="mx-auto max-w-3xl text-sm text-muted">Loading deck…</p>
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
            <Card className="relative p-0">
              <div className="h-1.5 rounded-t-card bg-accent" />
              <div className="p-6">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-accent-ink">
                  <Icon name="link" size={13} />
                  Shared deck
                </span>
                <h1 className="font-display mt-3 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
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

            {/* study modes — each nudges the guest to sign in */}
            <div>
              <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-[0.06em] text-muted">
                Study modes
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <LockedMode
                  primary
                  icon="clipboard"
                  label="Quiz me — Multiple choice"
                  desc="Log in to take the MCQ exam and track your progress"
                  onClick={() => setAuthOpen(true)}
                />
                <LockedMode
                  icon="cards"
                  color="var(--info)"
                  label="Flashcards"
                  desc="Log in to flip through every card"
                  onClick={() => setAuthOpen(true)}
                />
                <LockedMode
                  icon="shuffle"
                  color="var(--success)"
                  label="Match"
                  desc="Log in to race the pairing game"
                  onClick={() => setAuthOpen(true)}
                />
              </div>
            </div>

            {/* cards list — blurred behind a sign-in prompt */}
            <div>
              <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-[0.06em] text-muted">
                Cards in this deck
              </p>
              <div className="relative">
                <ul className="space-y-2 blur-sm select-none" aria-hidden>
                  {cards.slice(0, PREVIEW_ROWS).map((c, i) => (
                    <CardPreviewRow key={`${c.id}#${i}`} front={c.front} back={c.back} />
                  ))}
                </ul>
                <div className="absolute inset-0 grid place-items-center">
                  <div className="rounded-card border border-line bg-surface/95 p-6 text-center shadow-card backdrop-blur">
                    <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-accent-soft text-accent-ink">
                      <Icon name="lock" size={20} />
                    </span>
                    <p className="mt-3 text-sm font-semibold text-ink">
                      Log in to study this deck
                    </p>
                    <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-muted">
                      Create a free account (or log in) to see every card, quiz yourself, and keep
                      your progress.
                    </p>
                    <button
                      type="button"
                      onClick={() => setAuthOpen(true)}
                      className="focus-ring mt-4 inline-flex rounded-input bg-accent px-4 py-2 text-sm font-semibold text-white shadow-btn transition hover:opacity-95"
                    >
                      Log in or sign up
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {authOpen && (
        <AuthModal
          title="Study this deck"
          description="Create an account (or log in) to study this deck and keep your progress."
          loginLabel="Log in"
          signupLabel="Sign up"
          onClose={() => setAuthOpen(false)}
          onAuthed={() => {
            // Now signed in — the real deck page takes over (progress + all modes).
            router.push(`/decks/${deckId}`);
            router.refresh();
          }}
        />
      )}
    </AppChrome>
  );
}

// A study-mode tile that looks live but is locked for guests — a small lock badge
// marks it, and the whole tile opens the sign-in modal.
function LockedMode({
  icon,
  label,
  desc,
  color = "var(--accent)",
  primary = false,
  onClick,
}: {
  icon: IconName;
  label: string;
  desc: string;
  color?: string;
  primary?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex items-center gap-3.5 rounded-card border p-4 text-left transition ${
        primary
          ? "border-transparent bg-accent shadow-btn hover:opacity-95"
          : "border-line bg-surface hover:-translate-y-0.5 hover:border-line-strong"
      }`}
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
        <span className={`flex items-center gap-2 text-sm font-bold ${primary ? "text-white" : "text-ink"}`}>
          {label}
        </span>
        <span className={`mt-0.5 block text-xs ${primary ? "text-white/80" : "text-muted"}`}>
          {desc}
        </span>
      </span>
      <span className={`ml-auto shrink-0 ${primary ? "text-white/90" : "text-faint"}`}>
        <Icon name="lock" size={16} />
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
