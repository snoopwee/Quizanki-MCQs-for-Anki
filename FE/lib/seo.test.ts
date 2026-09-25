import { describe, expect, it } from "vitest";
import { deckDescription, deckTitle, profileDescription, profileTitle } from "./seo";

describe("deckTitle", () => {
  it("leads with the deck's own name — that's what was shared", () => {
    expect(deckTitle({ name: "JLPT N3 kanji", cardCount: 120, authorName: "mai" }))
      .toBe("JLPT N3 kanji — 120 cards");
    expect(deckTitle({ name: "Solo", cardCount: 1, authorName: null })).toBe("Solo — 1 card");
  });

  it("survives a deck with no name or no count", () => {
    expect(deckTitle({ name: "  ", cardCount: 5, authorName: null })).toBe("A shared deck");
    expect(deckTitle({ name: "Kana", cardCount: null, authorName: null })).toBe("Kana");
  });
});

describe("deckDescription", () => {
  it("says what it is, who made it, and how it scored", () => {
    expect(deckDescription({ name: "X", cardCount: 120, authorName: "mai", ratingCount: 12, ratingAverage: 4.25 }))
      .toBe("Study 120 cards as a quiz, flashcards or a matching game. Shared by mai. Rated 4.3 out of 5 by 12 people.");
  });

  it("omits a score nobody has given", () => {
    // "Rated 0.0 out of 5" in a search result reads as a warning, not an absence.
    const d = deckDescription({ name: "X", cardCount: 8, authorName: "mai", ratingCount: 0, ratingAverage: 0 });
    expect(d).not.toMatch(/Rated/);
    expect(d).toBe("Study 8 cards as a quiz, flashcards or a matching game. Shared by mai.");
  });

  it("stays inside the ~160 chars search results show, cutting at a word", () => {
    const d = deckDescription({
      name: "X", cardCount: 1, authorName: "a".repeat(200), ratingCount: 3, ratingAverage: 5,
    });
    expect(d.length).toBeLessThanOrEqual(160);
    expect(d.endsWith("…")).toBe(true);
    expect(d).not.toMatch(/\s…$/);
  });
});

describe("profile metadata", () => {
  it("titles a profile by its handle", () => {
    expect(profileTitle({ username: "hoangtester", deckCount: 6 })).toBe("hoangtester's decks");
    expect(profileTitle({ username: null, deckCount: 0 })).toBe("A learner's page");
  });

  it("describes what they've published, and their reach when they have any", () => {
    expect(profileDescription({ username: "mai", deckCount: 6, followers: 3 }))
      .toBe("6 public decks by mai on Quizanki. Followed by 3 people.");
    expect(profileDescription({ username: "mai", deckCount: 1, followers: 1 }))
      .toBe("1 public deck by mai on Quizanki. Followed by 1 person.");
  });

  it("says so plainly when there is nothing published", () => {
    expect(profileDescription({ username: "mai", deckCount: 0, followers: 0 }))
      .toBe("mai hasn't published any decks yet on Quizanki.");
  });
});
