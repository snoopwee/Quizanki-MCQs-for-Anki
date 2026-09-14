// Pure display helpers for the daily study streak (the Home streak tile + its 7-day strip).

/**
 * Parses a "YYYY-MM-DD" date from the backend as a LOCAL calendar date.
 *
 * Never use `new Date("2026-09-14")` for these: a bare date string is parsed as midnight
 * UTC, which in every timezone west of UTC is still the previous day, so the strip would
 * label each day with the wrong weekday. The backend already computed the date in the
 * user's own timezone — the client should only read its parts.
 */
export function parseLocalDate(isoDate: string): Date {
  const [y = 1970, m = 1, d = 1] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Weekday of a backend date: "M" (narrow, under a strip dot) or "Monday" (long, for labels). */
export function weekdayLabel(isoDate: string, style: "narrow" | "long" = "narrow"): string {
  return parseLocalDate(isoDate).toLocaleDateString("en-US", { weekday: style });
}

/** "1 day" / "12 days". */
export function streakValue(days: number): string {
  return `${days} ${days === 1 ? "day" : "days"}`;
}

/**
 * The one-line status under the streak number. A streak survives until the end of a day
 * you haven't studied yet, so "not studied today" is a nudge, never a loss. Kept short: it
 * shares a mono line with "· best N" inside a third-width tile and must not wrap.
 */
export function streakCaption(streak: { current: number; studiedToday: boolean }): string {
  if (streak.studiedToday) return "Done today";
  if (streak.current > 0) return "Study today";
  return "Start today";
}
