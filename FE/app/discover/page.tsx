"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useDiscoverDecks } from "@/hooks/useDecks";
import { useSession } from "@/hooks/useSession";
import { DeckAuthor } from "@/components/deck/DeckAuthor";
import { BrandMark } from "@/components/ui/BrandMark";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/icons";

// Every deck people have chosen to publish. Open to everyone — a guest browses
// exactly what a member does. Copying a deck is the part that needs an account,
// and that lives on the deck's own /shared/{id} page.
//
// Outside the (app) route group on purpose: that layout requires a session.

const SEARCH_DEBOUNCE_MS = 250;

export default function DiscoverPage() {
  const { user, loading } = useSession();
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");

  // Debounced so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(input.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [input]);

  const decksQuery = useDiscoverDecks(query);
  const decks = decksQuery.data ?? [];

  return (
    <div className="relative min-h-screen">
      <div aria-hidden className="landing-grid pointer-events-none absolute inset-0 -z-10" />

      <header className="sticky top-0 z-40 border-b border-line bg-canvas/80 backdrop-blur">
        <div className="flex items-center justify-between px-6 py-4 sm:px-8">
          <Link href="/">
            <BrandMark />
          </Link>
          {!loading && (
            <Link
              href={user ? "/dashboard" : "/"}
              className="rounded-full border border-line-strong bg-surface px-4 py-1.5 text-sm font-semibold text-ink transition hover:border-accent hover:text-accent"
            >
              {user ? "Dashboard →" : "Log in"}
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-6 py-10">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink">Discover decks</h1>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted">
            Decks people have shared. Open one to preview it, then save your own copy — you get your
            own cards and your own progress.
          </p>
        </div>

        <div className="relative max-w-md">
          <span
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
          >
            <Icon name="search" size={16} />
          </span>
          <input
            type="search"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            aria-label="Search shared decks"
            placeholder="Search shared decks…"
            className="focus-ring w-full rounded-input border border-line bg-surface-2 py-2 pl-9 pr-3 text-sm text-ink placeholder:text-faint"
          />
        </div>

        {decksQuery.isLoading && <p className="text-sm text-muted">Loading decks…</p>}

        {decksQuery.isError && (
          <p className="text-sm text-danger">Couldn&apos;t load shared decks. Please try again.</p>
        )}

        {decksQuery.data && decks.length === 0 && (
          <Card className="p-8 text-center">
            <p className="text-sm font-medium text-ink">
              {query ? `No shared decks match “${query}”.` : "No decks have been shared yet."}
            </p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
              {query
                ? "Try a different search."
                : "Import one of your own and set it to public — it'll show up here."}
            </p>
          </Card>
        )}

        {decks.length > 0 && (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {decks.map((deck) => (
              <li key={deck.id}>
                <Link href={`/shared/${deck.id}`} className="block">
                  <Card hover className="overflow-hidden p-0">
                    <div className="h-1.5 bg-accent" />
                    <div className="space-y-2 p-5">
                      <p className="truncate font-display text-base font-semibold text-ink">
                        {deck.name}
                      </p>
                      <p className="inline-flex items-center gap-1.5 font-mono text-xs text-faint">
                        <Icon name="layers" size={13} />
                        {deck.cardCount ?? 0} card{deck.cardCount === 1 ? "" : "s"}
                      </p>
                      <DeckAuthor
                        authorName={deck.authorName}
                        sourceAuthorName={deck.sourceAuthorName}
                        className="block"
                      />
                    </div>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
