// Pure display helpers for the notification bell: what the badge says, how old a row reads, and
// where a row is allowed to send you.

/** Above this the badge stops counting — "9+" keeps the dot the same width as the bell. */
export const BADGE_CAP = 9;

/** What the badge shows, or null when there is nothing to show. */
export function unreadBadge(unread: number): string | null {
  if (!Number.isFinite(unread) || unread < 1) return null;
  return unread > BADGE_CAP ? `${BADGE_CAP}+` : String(Math.floor(unread));
}

/** The bell's accessible name. The badge itself is decorative, so the count has to live here. */
export function unreadLabel(unread: number): string {
  const count = Number.isFinite(unread) ? Math.max(0, Math.floor(unread)) : 0;
  if (count === 0) return "Notifications";
  return `Notifications, ${count} unread`;
}

/**
 * Compact age for a row: "just now", "5m", "3h", "2d", then a date once it's a week old — the
 * panel is narrow, so this sits in the corner of a row rather than spelling out a timestamp.
 *
 * `now` is a parameter so this is testable and so a render can pass one clock to a whole list.
 */
export function relativeTime(createdAt: string | null | undefined, now: Date = new Date()): string {
  if (!createdAt) return "";
  const then = new Date(createdAt);
  const ms = then.getTime();
  if (Number.isNaN(ms)) return "";

  const seconds = Math.round((now.getTime() - ms) / 1000);
  // A clock skew between browser and server can put a fresh row slightly in the future; that is
  // "just now", not "in 3 seconds".
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;

  return then.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Where a notification may send the reader. `link` arrives from the server as a snapshot taken
 * when the row was written, so it is treated as untrusted input: only a plain in-app path is
 * allowed through.
 *
 * Rejected: absolute URLs (`https://…`), scheme-relative ones (`//evil.example`), anything with a
 * scheme at all (`javascript:…`), and backslash tricks that some browsers normalise to `//`.
 */
export function inAppHref(link: string | null | undefined): string | null {
  if (!link) return null;
  const href = link.trim();
  if (!href.startsWith("/")) return null;
  if (href.startsWith("//") || href.startsWith("/\\")) return null;
  if (href.includes("\\")) return null;
  return href;
}
