// The report vocabularies, in one place so the report forms and the admin filter can never drift
// apart — a filter offering a reason nobody can pick would quietly always return nothing.
//
// The two queues have different vocabularies on purpose. A deck is public work, so it is reported
// for what it IS (spam, copyright, wrong); a note is text aimed at one person, so it is reported
// for how it BEHAVES (abusive, harassment).

export const DECK_REPORT_REASONS = [
  "Spam",
  "Inappropriate",
  "Copyright",
  "Wrong or misleading",
  "Other",
] as const;

export const NOTE_REPORT_REASONS = [
  "Abusive",
  "Harassment",
  "Spam",
  "Off-topic",
  "Other",
] as const;

export function reasonsFor(queue: "decks" | "notes"): readonly string[] {
  return queue === "decks" ? DECK_REPORT_REASONS : NOTE_REPORT_REASONS;
}

/**
 * Quick-fill reasons for an admin closing a report. Templates, not a fixed list: the point is to
 * make the common decision one click without stopping anybody typing something specific.
 *
 * Takedown wording is written to be READ BY THE PERSON whose rating is being removed — it goes
 * into their notification — so it explains rather than labels.
 */
export const RESOLVE_TEMPLATES = [
  "Confirmed — the content broke the rules and has been removed.",
  "Confirmed, and the account has been warned.",
  "Handled outside the queue.",
] as const;

export const DISMISS_TEMPLATES = [
  "Checked — this doesn't break any rule.",
  "This is honest criticism, not abuse.",
  "Not enough to act on.",
  "Duplicate of another report.",
] as const;

export const TAKEDOWN_TEMPLATES = [
  "This was a personal attack rather than feedback about the deck.",
  "This contained abusive language.",
  "This was spam or advertising.",
  "This was unrelated to the deck.",
] as const;

/**
 * Quick-fill reasons for suspending an account. Written to be READ BY THE PERSON SUSPENDED — they
 * see this verbatim on their next visit — so each one names the behaviour rather than labelling
 * the person.
 */
export const SUSPEND_TEMPLATES = [
  "Repeatedly uploaded copyrighted material after a warning.",
  "Used ratings to harass other people.",
  "Published spam or advertising as decks.",
  "Created decks designed to mislead learners.",
] as const;

/** And for lifting one — this becomes the message in their "account restored" notification. */
export const RESTORE_TEMPLATES = [
  "Reviewed and lifted — thanks for your patience.",
  "Suspended by mistake. Sorry about that.",
  "Appealed successfully.",
] as const;
