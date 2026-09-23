"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useUserPage } from "@/hooks/useDecks";
import { initialsFrom } from "@/lib/userDisplay";
import { AppChrome } from "@/components/layout/AppChrome";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/icons";
import { StarRating } from "@/components/ui/StarRating";
import { FollowButton } from "@/components/author/FollowButton";
import { AudienceSection } from "@/components/author/AudienceSection";
import { useFollowStatus } from "@/hooks/useFollows";
import { useSession } from "@/hooks/useSession";

// Somebody's public profile page, at the URL people actually share: /user/{username} — an identity
// header plus the decks this person has published. Public decks only: you can't expose an author's
// private decks to other viewers.
//
// The handle is a label on top of the user id, which stays the identity everywhere else — so
// /authors/{userId} remains a permanent alias that redirects here, and old links never rot.
//
// Outside the (app) route group so guests can view it; AppChrome adds the sidebar for signed-in
// users. Name and avatar come from the backend's `profiles` row (falling back to a deck's credit
// snapshot); a missing avatar falls back to initials.
//
// Publishing nothing is NOT the same as not existing: a learner with no decks still gets a real
// page with a name and a Follow button, which is what makes a follower list worth clicking. Only a
// user the backend has never heard of 404s, and that lands on <NotFound />.

export default function UserProfilePage() {
  const { username } = useParams<{ username: string }>();
  const query = useUserPage(username);
  const { user } = useSession();
  const page = query.data;
  // The handle is only the URL. Everything else — follows, the private lists — is keyed by the
  // user id behind it, so a rename can never orphan a row.
  const authorId = page?.authorId ?? "";
  // Same query key the follow button uses, so this is a dedupe rather than a second request. It
  // is what tells us the page is the viewer's own, which is what unlocks the private lists.
  const status = useFollowStatus(authorId, Boolean(user));
  const decks = page?.decks ?? [];
  // Somebody can exist without ever setting a name, so this is a fallback, not a loading state.
  const name = page?.authorName ?? "";
  const shownName = name || "A learner who hasn't set a name";
  const isSelf = status.data?.self === true;

  return (
    <AppChrome>
      <div className="mx-auto max-w-5xl space-y-8">
        {query.isLoading && <p className="text-sm text-muted">Loading author…</p>}

        {query.isError && <NotFound />}

        {page && (
          <>
            {/* identity header (profile-style) */}
            <div className="flex items-center gap-4 rounded-card border border-line bg-surface p-5">
              <Avatar
                url={page.authorAvatarUrl}
                initials={initialsFrom(name, "")}
                className="h-16 w-16 text-xl"
              />
              <div className="min-w-0 flex-1">
                <p
                  className={`truncate font-display text-xl font-bold tracking-tight ${
                    name ? "text-ink" : "text-muted"
                  }`}
                >
                  {shownName}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-faint">
                  <span className="inline-flex items-center gap-1.5">
                    {/* "Author" would be a stretch for somebody who has published nothing. */}
                    <Icon name="user" size={13} /> {page.deckCount > 0 ? "Author" : "Learner"}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Icon name="layers" size={13} /> {page.deckCount} public deck
                    {page.deckCount === 1 ? "" : "s"}
                  </span>
                  {/* Public, so a guest sees it too. Whether YOU follow them is personal and
                      lives in the button. */}
                  <span className="inline-flex items-center gap-1.5">
                    <Icon name="bookmark" size={13} /> {page.followers} follower
                    {page.followers === 1 ? "" : "s"}
                  </span>
                </div>
              </div>
              <div className="shrink-0">
                <FollowButton authorId={authorId} authorName={name} />
              </div>
            </div>

            {/* Your own audience. Public counts, private lists — a visitor sees neither tab. */}
            {isSelf && <AudienceSection authorId={authorId} followerCount={page.followers} />}

            {/* deck grid (Home-style) */}
            {decks.length === 0 ? (
              <NoPublicDecks isSelf={isSelf} />
            ) : (
            <div>
              <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-[0.06em] text-muted">
                Decks by {shownName}
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
                          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-faint">
                            <span className="inline-flex items-center gap-1.5">
                              <Icon name="layers" size={13} />
                              {deck.cardCount ?? 0} card{deck.cardCount === 1 ? "" : "s"}
                            </span>
                            <StarRating
                              average={deck.ratingAverage}
                              count={deck.ratingCount}
                              size={13}
                            />
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
            )}
          </>
        )}
      </div>
    </AppChrome>
  );
}

function NoPublicDecks({ isSelf }: { isSelf: boolean }) {
  return (
    <Card className="p-8 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-input bg-accent-soft text-accent">
        <Icon name="cards" size={24} />
      </span>
      <p className="mt-3 text-sm font-medium text-ink">Nothing shared yet</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
        {isSelf
          ? "You haven't published any decks. Share one and it shows up here — and your followers hear about it."
          : "This person hasn't published any decks. Follow them and you'll hear when they do."}
      </p>
      <Link
        href={isSelf ? "/home" : "/discover"}
        className="focus-ring mt-5 inline-flex rounded-input bg-accent px-4 py-2 text-sm font-semibold text-white shadow-btn transition hover:opacity-95"
      >
        {isSelf ? "Go to your decks" : "Browse Discover"}
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
