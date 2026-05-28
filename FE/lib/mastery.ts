// Mastery curve mirror — MUST match BE/src/main/resources/db/migration/V3__add_card_mastery.sql.
// The SQL function `record_answer` is the source of truth for authenticated users; these
// constants exist ONLY so the guest trial flow can simulate the same math in the browser
// (guests have no card_stats row). When tuning the curve, ship a new V*.sql AND update
// the constants here in the same change set.

export const MASTERY_CORRECT_DELTA = 15;
export const MASTERY_WRONG_DELTA = -20;
export const MASTERY_MIN = 0;
export const MASTERY_MAX = 100;

export function applyAnswer(mastery: number, correct: boolean): number {
  const delta = correct ? MASTERY_CORRECT_DELTA : MASTERY_WRONG_DELTA;
  return Math.max(MASTERY_MIN, Math.min(MASTERY_MAX, mastery + delta));
}
