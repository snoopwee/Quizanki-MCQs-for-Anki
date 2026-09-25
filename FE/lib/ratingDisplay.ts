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

/**
 * "4.2" — always one decimal, including "5.0" and "0.0".
 *
 * The trailing ".0" is kept on purpose: these sit in a row of deck cards, and a column that reads
 * 4.2 / 5 / 3.8 looks ragged where 4.2 / 5.0 / 3.8 lines up. An unrated deck is "0.0", not blank,
 * because the score is now shown before anybody has rated.
 */
export function formatAverage(average: number): string {
  const score = Number.isFinite(average) ? Math.min(Math.max(average, 0), STARS) : 0;
  return (Math.round(score * 10) / 10).toFixed(1);
}

/**
 * "4.2 (17)" — the score and how many gave it, including "0.0 (0)".
 *
 * No "stars" in the string: it sits beside five star glyphs that already say so, and the word was
 * long enough to push the whole score onto a second line on a narrow deck card.
 */
export function ratingSummary(average: number, count: number): string {
  const rated = Number.isFinite(count) && count > 0;
  return `${formatAverage(rated ? average : 0)} (${rated ? Math.floor(count) : 0})`;
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
