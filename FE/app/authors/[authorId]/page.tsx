"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuthorPage } from "@/hooks/useDecks";
import { initialsFrom } from "@/lib/userDisplay";
import { AppChrome } from "@/components/layout/AppChrome";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/icons";

// A public author page — "all the decks this person made" — a mix of the profile
// page (identity header) and Home (deck grid). Public decks only: you can't expose
// an author's private decks to other viewers.
//
// Outside the (app) route group so guests can view it; AppChrome adds the sidebar
// for signed-in users. There's no user table, so the name and avatar come off the
// author's decks (denormalised, kept current by the profile propagation); a missing
// avatar falls back to initials.

export default function AuthorPage() {
  const { authorId } = useParams<{ authorId: string }>();
  const query = useAuthorPage(authorId);
  const page = query.data;
  const decks = page?.decks ?? [];
  const name = page?.authorName ?? "";

  return (
    <AppChrome>
      <div className="mx-auto max-w-5xl space-y-8">
        {query.isLoading && <p className="text-sm text-muted">Loading author…</p>}

        {query.isError && <NotFound />}

        {page && !name && <NoPublicDecks />}

        {page && name && (
          <>
            {/* identity header (profile-style) */}
            <div className="flex items-center gap-4 rounded-card border border-line bg-surface p-5">
              <Avatar
                url={page.authorAvatarUrl}
                initials={initialsFrom(name, "")}
                className="h-16 w-16 text-xl"
              />
              <div className="min-w-0">
                <p className="truncate font-display text-xl font-bold tracking-tight text-ink">
                  {name}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-faint">
                  <span className="inline-flex items-center gap-1.5">
                    <Icon name="user" size={13} /> Author
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Icon name="layers" size={13} /> {page.deckCount} public deck
                    {page.deckCount === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
            </div>

            {/* deck grid (Home-style) */}
            <div>
              <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-[0.06em] text-muted">
                Decks by {name}
              </p>
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                          {deck.sourceAuthorName && deck.sourceAuthorName !== name && (
                            <p className="text-xs text-faint">
                              Original deck by {deck.sourceAuthorName}
                            </p>
                          )}
                        </div>
                      </Card>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </AppChrome>
  );
}

function NoPublicDecks() {
  return (
    <Card className="p-8 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-input bg-accent-soft text-accent">
        <Icon name="cards" size={24} />
      </span>
      <p className="mt-3 text-sm font-medium text-ink">Nothing shared yet</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
        This author hasn&apos;t published any decks. Check back later, or explore what others have
        shared.
      </p>
      <Link
        href="/discover"
        className="focus-ring mt-5 inline-flex rounded-input bg-accent px-4 py-2 text-sm font-semibold text-white shadow-btn transition hover:opacity-95"
      >
        Browse Discover
      </Link>
    </Card>
  );
}

function NotFound() {
  return (
    <Card className="p-6 text-center">
      <h1 className="font-display text-xl font-semibold tracking-tight">Author not found</h1>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
        We couldn&apos;t load this author. The link may be wrong.
      </p>
      <Link
        href="/discover"
        className="focus-ring mt-5 inline-flex rounded-input bg-accent px-4 py-2 text-sm font-semibold text-white shadow-btn transition hover:opacity-95"
      >
        Browse Discover
      </Link>
    </Card>
  );
}
