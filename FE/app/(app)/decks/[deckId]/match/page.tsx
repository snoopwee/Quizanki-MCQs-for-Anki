"use client";

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useDeckContents } from "@/hooks/useDecks";
import { deckContentsToParsed } from "@/lib/deckContents";
import { buildFlashcards } from "@/lib/flashcards";
import { MatchGame } from "@/components/deck/MatchGame";

// The Match screen takes over the full layout (the sidebar is hidden by AppShell
// for any /match URL). It loads the deck's cards itself — no store handoff — so a
// direct navigation or refresh works.
export default function DeckMatchPage() {
  const { deckId } = useParams<{ deckId: string }>();
  const router = useRouter();
  const contentsQuery = useDeckContents(deckId);

  const cards = useMemo(
    () => (contentsQuery.data ? buildFlashcards(deckContentsToParsed(contentsQuery.data).noteTypes) : []),
    [contentsQuery.data],
  );

  if (contentsQuery.isLoading) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <p className="text-sm text-muted">Loading match…</p>
      </div>
    );
  }

  if (contentsQuery.isError || !contentsQuery.data) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <p className="text-sm text-muted">Deck not found.</p>
      </div>
    );
  }

  return (
    <MatchGame
      cards={cards}
      deckId={deckId}
      deckName={contentsQuery.data.name}
      onExit={() => router.push(`/decks/${deckId}`)}
    />
  );
}
