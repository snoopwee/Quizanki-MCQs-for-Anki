"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/Spinner";
import { useFollowers, useFollowing } from "@/hooks/useFollows";
import { initialsFrom } from "@/lib/userDisplay";
import { profileUrl } from "@/lib/profileUrl";

type Tab = "followers" | "following";

/**
 * Who follows you, and who you follow — on your own author page, which IS your public profile
 * page. Rendered only when the page is yours: the follower COUNT is public (it is in the header),
 * the list is not, and the backend answers 404 to anybody else asking.
 *
 * Both lists live here rather than on `/profile` because `/profile` is the account settings page —
 * name, email, avatar — and these are about people, not about your account.
 */
export function AudienceSection({
  authorId,
  followerCount,
}: {
  authorId: string;
  followerCount: number;
}) {
  const [tab, setTab] = useState<Tab>("followers");
  const followers = useFollowers(authorId, true);
  const following = useFollowing();

  const active = tab === "followers" ? followers : following;
  const followingCount = following.data?.length;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-line p-5">
        <TabButton active={tab === "followers"} onClick={() => setTab("followers")}>
          {followerCount} follower{followerCount === 1 ? "" : "s"}
        </TabButton>
        <TabButton active={tab === "following"} onClick={() => setTab("following")}>
          Following{followingCount === undefined ? "" : ` ${followingCount}`}
        </TabButton>
        <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-faint">
          <Icon name="eye" size={13} /> Only you can see these lists
        </span>
      </div>

      <div className="p-5">
        {active.isLoading ? (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Spinner className="h-4 w-4 text-accent" /> Loading…
          </p>
        ) : active.isError ? (
          <p className="text-sm text-danger">
            Couldn&apos;t load {tab === "followers" ? "your followers" : "who you follow"}.
          </p>
        ) : tab === "followers" ? (
          <FollowerRows rows={followers.data ?? []} />
        ) : (
          <FollowingRows rows={following.data ?? []} />
        )}
      </div>
    </Card>
  );
}

function FollowerRows({
  rows,
}: {
  rows: NonNullable<ReturnType<typeof useFollowers>["data"]>;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted">
        Nobody follows you yet. Publish a deck and share the link — that&apos;s how people find you.
      </p>
    );
  }

  return (
    <ul className="space-y-1">
      {rows.map((person) => (
        // Every known user has a page, published or not, so these rows go somewhere: their decks
        // if they have any, and a Follow button either way — this is the route to following back.
        <li key={person.userId}>
          <Link
            href={profileUrl(person.userId, person.username)}
            className="focus-ring flex items-center gap-3 rounded-input px-2 py-2 transition hover:bg-surface-2"
          >
            <Avatar
              url={person.avatarUrl}
              initials={initialsFrom(person.displayName ?? "", "")}
              className="h-9 w-9 shrink-0 text-sm"
            />
            <span
              className={`min-w-0 flex-1 truncate text-sm font-medium ${
                person.displayName ? "text-ink" : "text-muted"
              }`}
            >
              {person.displayName ?? "A learner who hasn't set a name"}
            </span>
            <Icon name="chevronRight" size={15} className="shrink-0 text-faint" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function FollowingRows({
  rows,
}: {
  rows: NonNullable<ReturnType<typeof useFollowing>["data"]>;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted">
        You aren&apos;t following anyone yet. Open an author from{" "}
        <Link href="/discover" className="font-medium text-accent hover:underline">
          Discover
        </Link>{" "}
        and follow them to hear when they publish.
      </p>
    );
  }

  return (
    <ul className="space-y-1">
      {rows.map((author) => (
        <li key={author.authorId}>
          <Link
            href={profileUrl(author.authorId, author.username)}
            className="focus-ring flex items-center gap-3 rounded-input px-2 py-2 transition hover:bg-surface-2"
          >
            <Avatar
              url={author.authorAvatarUrl}
              initials={initialsFrom(author.authorName ?? "", "")}
              className="h-9 w-9 shrink-0 text-sm"
            />
            <span className="min-w-0 flex-1">
              {/* Named from their profile, so this only falls back for somebody who has never
                  set a name — the deck count below says whether they have published. */}
              <span
                className={`block truncate text-sm font-medium ${
                  author.authorName ? "text-ink" : "text-muted"
                }`}
              >
                {author.authorName ?? "A learner who hasn't set a name"}
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
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
        active
          ? "border-accent bg-accent-soft text-accent-ink"
          : "border-line bg-surface text-muted hover:border-line-strong hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
