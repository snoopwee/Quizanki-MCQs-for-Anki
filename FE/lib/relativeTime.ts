// A compact "time ago" label for creation stamps ("2 days ago", "1 hour ago",
// "4 years ago"). Uses Intl.RelativeTimeFormat so it localises, with numeric:
// "always" to get the "1 day ago" wording the design calls for (numeric:"auto"
// would say "yesterday"). Very recent stamps collapse to "just now" rather than
// "0 seconds ago". Returns null for a missing / unparseable stamp so callers can
// omit the line entirely.

const DIVISIONS: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, unit: "second" },
  { amount: 60, unit: "minute" },
  { amount: 24, unit: "hour" },
  { amount: 7, unit: "day" },
  { amount: 4.34524, unit: "week" },
  { amount: 12, unit: "month" },
  { amount: Number.POSITIVE_INFINITY, unit: "year" },
];

export function timeAgo(iso: string | null | undefined, now: number = Date.now()): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;

  const seconds = (then - now) / 1000; // negative for the past
  if (seconds > -45) return "just now"; // < ~45s ago (also covers tiny clock skew)

  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "always" });
  let duration = seconds;
  for (const division of DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return rtf.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }
  return null;
}
