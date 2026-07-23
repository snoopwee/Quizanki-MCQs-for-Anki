import { Icon } from "@/components/ui/icons";

/**
 * Who made a deck: "by Alice", plus "Original deck by Bob" when it started life
 * as a copy of someone else's work.
 *
 * The source line is suppressed when it matches the author, which is the case
 * for a copy nobody has edited yet — there, both names are the original author's
 * and "by Alice · Original deck by Alice" would just read as a bug.
 */
export function DeckAuthor({
  authorName,
  sourceAuthorName,
  className = "",
}: {
  authorName: string | null;
  sourceAuthorName: string | null;
  className?: string;
}) {
  // Decks imported before authorship existed have no stored name; they get one
  // on their next save. Until then, say nothing rather than "by null".
  if (!authorName) return null;
  const showSource = Boolean(sourceAuthorName) && sourceAuthorName !== authorName;

  return (
    <span className={`inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs ${className}`}>
      <span className="inline-flex items-center gap-1 text-muted">
        <Icon name="user" size={13} />
        by <span className="font-medium text-ink">{authorName}</span>
      </span>
      {showSource && (
        <span className="text-faint">Original deck by {sourceAuthorName}</span>
      )}
    </span>
  );
}
