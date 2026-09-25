// How a shared link describes itself. Pure string-building, kept out of the metadata functions so
// the wording is testable without a server render.
//
// The shape of every description is the same: say what the thing IS, then give the one number that
// makes it worth opening. A preview that reads "Quizanki" tells a reader nothing about whether to
// click, which is the whole problem this replaces.

/** Long enough for search results (~160 chars), short enough that nothing is cut mid-word. */
const MAX_DESCRIPTION = 160;

export type DeckSeo = {
  name: string | null | undefined;
  cardCount: number | null | undefined;
  authorName: string | null | undefined;
  ratingCount?: number | null;
  ratingAverage?: number | null;
};

export type ProfileSeo = {
  username: string | null | undefined;
  deckCount: number | null | undefined;
  followers?: number | null;
};

/** "JLPT N3 kanji — 120 cards" — the deck's own name leads, because that is what was shared. */
export function deckTitle(deck: DeckSeo): string {
  const name = clean(deck.name);
  if (!name) return "A shared deck";
  const cards = count(deck.cardCount);
  return cards === null ? name : `${name} — ${cards} ${plural(cards, "card")}`;
}

export function deckDescription(deck: DeckSeo): string {
  const cards = count(deck.cardCount);
  const parts: string[] = [];

  parts.push(
    cards === null
      ? "Study this deck as a quiz, flashcards or a matching game."
      : `Study ${cards} ${plural(cards, "card")} as a quiz, flashcards or a matching game.`,
  );

  const author = clean(deck.authorName);
  if (author) parts.push(`Shared by ${author}.`);

  // Only once somebody has rated it: "0.0 (0)" in a search result reads as a warning.
  const ratings = count(deck.ratingCount);
  if (ratings !== null && ratings > 0 && typeof deck.ratingAverage === "number") {
    const score = (Math.round(deck.ratingAverage * 10) / 10).toFixed(1);
    parts.push(`Rated ${score} out of 5 by ${ratings} ${plural(ratings, "person", "people")}.`);
  }

  return truncate(parts.join(" "));
}

/** "hoangtester" — a profile is a person, so the handle is the whole title. */
export function profileTitle(profile: ProfileSeo): string {
  const name = clean(profile.username);
  return name ? `${name}'s decks` : "A learner's page";
}

export function profileDescription(profile: ProfileSeo): string {
  const name = clean(profile.username) ?? "This learner";
  const decks = count(profile.deckCount);
  const followers = count(profile.followers);

  if (decks === null || decks === 0) {
    return truncate(`${name} hasn't published any decks yet on Quizanki.`);
  }

  const parts = [`${decks} public ${plural(decks, "deck")} by ${name} on Quizanki.`];
  if (followers !== null && followers > 0) {
    parts.push(`Followed by ${followers} ${plural(followers, "person", "people")}.`);
  }
  return truncate(parts.join(" "));
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** A count only counts when it is a real, non-negative number. */
function count(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : null;
}

function plural(n: number, one: string, many?: string): string {
  return n === 1 ? one : (many ?? `${one}s`);
}

/** Cut at a word boundary — a description ending "…120 ca" looks broken, not truncated. */
function truncate(text: string): string {
  if (text.length <= MAX_DESCRIPTION) return text;
  const cut = text.slice(0, MAX_DESCRIPTION - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
