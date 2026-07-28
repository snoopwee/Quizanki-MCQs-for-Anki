import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { initialsFrom } from "@/lib/userDisplay";
import { timeAgo } from "@/lib/relativeTime";

type Variant = "inline" | "dot" | "detailed";

/**
 * Who made a deck, plus "Original deck by Bob" when it started life as a copy of
 * someone else's work. Three presentations:
 *
 * - `inline` (default): the author's avatar + "by Alice" on one line (Home cards,
 *   and the general case).
 * - `dot`: no avatar — a "·" separator + "by Alice", meant to sit inline after the
 *   card count (Discover cards, where a per-card avatar is visual noise).
 * - `detailed`: a larger avatar next to two stacked rows — the author's name, then
 *   the deck's creation time ("2 days ago") — for the deck-page header. Pass
 *   `createdAt` (the deck's importedAt) for the second row.
 *
 * When `authorId` is given the name links to that author's page. The source line is
 * suppressed when it matches the author — an unedited copy credits its original
 * author on both, and "by Alice · Original deck by Alice" would just read as a bug.
 */
export function DeckAuthor({
  authorId,
  authorName,
  authorAvatarUrl,
  sourceAuthorName,
  variant = "inline",
  createdAt,
  className = "",
}: {
  authorId?: string | null;
  authorName: string | null;
  authorAvatarUrl?: string | null;
  sourceAuthorName: string | null;
  variant?: Variant;
  /** Deck creation stamp, shown as "… ago" on the `detailed` variant. */
  createdAt?: string | null;
  className?: string;
}) {
  // Decks imported before authorship existed have no stored name; they get one on
  // their next save. Until then, say nothing rather than "by null".
  if (!authorName) return null;
  const showSource = Boolean(sourceAuthorName) && sourceAuthorName !== authorName;

  const nameNode = authorId ? (
    <Link
      href={`/authors/${authorId}`}
      onClick={(e) => e.stopPropagation()}
      className="font-medium text-ink underline-offset-2 hover:text-accent hover:underline"
    >
      {authorName}
    </Link>
  ) : (
    <span className="font-medium text-ink">{authorName}</span>
  );

  if (variant === "detailed") {
    const created = timeAgo(createdAt);
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <Avatar
          url={authorAvatarUrl}
          initials={initialsFrom(authorName, "")}
          className="h-10 w-10 text-sm"
        />
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm text-muted">by {nameNode}</p>
          <p className="mt-0.5 text-xs text-faint">
            {created ? `Created ${created}` : " "}
            {showSource && ` · Original deck by ${sourceAuthorName}`}
          </p>
        </div>
      </div>
    );
  }

  // A dot stands in for the avatar on Discover, where it reads as a separator
  // between the card count and the author.
  const leading =
    variant === "dot" ? (
      <span aria-hidden className="text-faint">
        ·
      </span>
    ) : (
      <Avatar
        url={authorAvatarUrl}
        initials={initialsFrom(authorName, "")}
        className="h-5 w-5 text-[9px]"
      />
    );

  return (
    <span className={`inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs ${className}`}>
      <span className="inline-flex items-center gap-1.5 text-muted">
        {leading}
        by {nameNode}
      </span>
      {showSource && <span className="text-faint">Original deck by {sourceAuthorName}</span>}
    </span>
  );
}
