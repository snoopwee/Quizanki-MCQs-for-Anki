"use client";

import Link from "next/link";
import { AccountSection } from "@/components/account/AccountSection";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/Spinner";
import { useFollowing } from "@/hooks/useFollows";
import { initialsFrom } from "@/lib/userDisplay";

// The authors you follow, newest first. Lives on the profile page rather than Home: Home's tabs
// are about decks, and this is about people.
export function FollowingList() {
  const following = useFollowing();
  const authors = following.data ?? [];

  return (
    <AccountSection
      icon="bookmark"
      title="Following"
      description="Authors whose new decks show up in your notifications."
    >
      {following.isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Spinner className="h-4 w-4 text-accent" /> Loading…
        </p>
      ) : following.isError ? (
        <p className="text-sm text-danger">Couldn&apos;t load who you follow.</p>
      ) : authors.length === 0 ? (
        <p className="text-sm text-muted">
          You aren&apos;t following anyone yet. Open an author from{" "}
          <Link href="/discover" className="font-medium text-accent hover:underline">
            Discover
          </Link>{" "}
          and follow them to hear when they publish.
        </p>
      ) : (
        <ul className="space-y-1">
          {authors.map((author) => (
            <li key={author.authorId}>
              <Link
                href={`/authors/${author.authorId}`}
                className="focus-ring flex items-center gap-3 rounded-input px-2 py-2 transition hover:bg-surface-2"
              >
                <Avatar
                  url={author.authorAvatarUrl}
                  initials={initialsFrom(author.authorName ?? "", "")}
                  className="h-9 w-9 shrink-0 text-sm"
                />
                <span className="min-w-0 flex-1">
                  {/* A follow outlives an author's decks, so a row with no name is a real state,
                      not a loading one. */}
                  <span className="block truncate text-sm font-medium text-ink">
                    {author.authorName ?? "An author who has unpublished everything"}
                  </span>
                  <span className="block font-mono text-xs text-faint">
                    {author.publicDecks} public deck{author.publicDecks === 1 ? "" : "s"}
                  </span>
                </span>
                <Icon name="chevronRight" size={15} className="shrink-0 text-faint" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AccountSection>
  );
}
