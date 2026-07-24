"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useCloneDeck, useSharedDeck } from "@/hooks/useDecks";
import { useSession } from "@/hooks/useSession";
import { deckContentsToParsed } from "@/lib/deckContents";
import { buildFlashcards } from "@/lib/flashcards";
import { AuthModal } from "@/components/auth/AuthModal";
import { AppChrome } from "@/components/layout/AppChrome";
import { CardPreviewRow } from "@/components/deck/CardPreview";
import { DeckAuthor } from "@/components/deck/DeckAuthor";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/icons";

// A deck someone shared, open to logged-out visitors. It's a read-only preview
// plus one action: take your own copy. Copying is what makes the deck studiable —
// progress is stored per note, and those notes belong to the owner, so a visitor
// needs their own cards before any of it can be tracked.
//
// Deliberately outside the (app) route group: that layout requires a session.
// Deliberately shows no owner identity — there's no user table to name them from.

const PREVIEW_LIMIT = 12;

export default function SharedDeckPage() {
  const { deckId } = useParams<{ deckId: string }>();
  const router = useRouter();
  const { user } = useSession();

  const deckQuery = useSharedDeck(deckId);
  const cloneDeck = useCloneDeck();
  const [authOpen, setAuthOpen] = useState(false);

  const cards = useMemo(
    () => (deckQuery.data ? buildFlashcards(deckContentsToParsed(deckQuery.data).noteTypes) : []),
    [deckQuery.data],
  );

  async function clone() {
    const deck = await cloneDeck.mutateAsync(deckId);
    router.push(`/decks/${deck.id}`);
    router.refresh();
  }

  // Signed out: authenticate first, then clone from inside the modal so the copy
  // lands before we navigate away.
  function handleSave() {
    if (user) {
      void clone();
    } else {
      setAuthOpen(true);
    }
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
                  authorName={deckQuery.data.authorName}
                  sourceAuthorName={deckQuery.data.sourceAuthorName}
                  className="mt-2"
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

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={cloneDeck.isPending}
                    className="focus-ring inline-flex items-center gap-2 rounded-input bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-btn transition hover:opacity-95 disabled:opacity-60"
                  >
                    <Icon name="download" size={16} />
                    {cloneDeck.isPending ? "Saving…" : "Save to my decks"}
                  </button>
                  <p className="text-xs text-muted">
                    You get your own copy — study it, edit it, track your own progress.
                  </p>
                </div>

                {cloneDeck.isError && (
                  <p className="mt-3 text-sm text-danger">
                    Couldn&apos;t save this deck. Please try again.
                  </p>
                )}
              </div>
            </Card>

            <section className="space-y-3">
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.06em] text-muted">
                Preview
              </p>
              <ul className="space-y-2">
                {cards.slice(0, PREVIEW_LIMIT).map((c, i) => (
                  <CardPreviewRow key={`${c.id}#${i}`} front={c.front} back={c.back} />
                ))}
              </ul>
              {cards.length > PREVIEW_LIMIT && (
                <p className="text-sm text-muted">
                  + {cards.length - PREVIEW_LIMIT} more card
                  {cards.length - PREVIEW_LIMIT === 1 ? "" : "s"} — save the deck to see them all.
                </p>
              )}
            </section>
          </>
        )}
      </div>

      {authOpen && (
        <AuthModal
          title="Save this deck"
          description="Create an account (or log in) to keep your own copy of this deck and track your progress."
          loginLabel="Log in & save"
          signupLabel="Sign up & save"
          onClose={() => setAuthOpen(false)}
          onAuthed={clone}
        />
      )}
    </AppChrome>
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
