// Pure helpers for deck ratings: how a score becomes five stars, and how it reads out loud.

export const STARS = 5;

export type StarFill = "full" | "half" | "empty";

/**
 * The five stars for a score. A star is full from three-quarters, half from a quarter, and empty
 * below that — so 4.2 shows four stars (not four and a half), and 4.3 shows four and a half. The
 * exact number is always printed next to them, so the stars only have to be honest, not precise.
 */
export function starFills(average: number): StarFill[] {
  const score = Number.isFinite(average) ? Math.min(Math.max(average, 0), STARS) : 0;
  return Array.from({ length: STARS }, (_, i) => {
    const remainder = score - i;
    if (remainder >= 0.75) return "full";
    if (remainder >= 0.25) return "half";
    return "empty";
  });
}

/** "4.2" — one decimal, but no trailing ".0" on a whole score. */
export function formatAverage(average: number): string {
  if (!Number.isFinite(average) || average <= 0) return "";
  const rounded = Math.round(average * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** "Not rated yet" / "1 rating" / "12 ratings". */
export function ratingCaption(count: number): string {
  if (!Number.isFinite(count) || count < 1) return "Not rated yet";
  return count === 1 ? "1 rating" : `${Math.floor(count)} ratings`;
}

/** What a screen reader hears instead of five star glyphs. */
export function ratingLabel(average: number, count: number): string {
  if (!Number.isFinite(count) || count < 1) return "Not rated yet";
  return `Rated ${formatAverage(average)} out of ${STARS}, ${ratingCaption(count)}`;
}

/**
 * Whether the rating control should be offered at all. You cannot rate your own deck (the backend
 * refuses it too), and a guest has nowhere to store a rating.
 */
export function canRate(options: { signedIn: boolean; isOwner: boolean }): boolean {
  return options.signedIn && !options.isOwner;
}
