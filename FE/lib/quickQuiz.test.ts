import { describe, expect, it } from "vitest";
import { quickQuizDeck, quickQuizDescription } from "./quickQuiz";
import type { DeckResponse } from "@/types/api";

function deck(name: string, cardCount: number | null = 10): DeckResponse {
  return {
    id: name.toLowerCase().replace(/\s+/g, "-"),
    name,
    subdeckPath: null,
    sourceFilename: null,
    cardCount,
    importedAt: null,
  } as DeckResponse;
}

describe("quickQuizDeck", () => {
  it("prefers the most recently opened deck — 'quick' means resume", () => {
    const chosen = quickQuizDeck([deck("Pharmacology")], [deck("Cell Biology")]);
    expect(chosen?.name).toBe("Pharmacology");
  });

  it("falls back to your own decks when nothing is recent", () => {
    // A fresh account has an empty Recent list but a full library.
    expect(quickQuizDeck([], [deck("Cell Biology")])?.name).toBe("Cell Biology");
    expect(quickQuizDeck(undefined, [deck("Cell Biology")])?.name).toBe("Cell Biology");
  });

  it("skips an empty deck rather than opening a quiz that dead-ends", () => {
    const chosen = quickQuizDeck([deck("Empty", 0), deck("Real", 5)], []);
    expect(chosen?.name).toBe("Real");
  });

  it("skips empty decks in the fallback list too", () => {
    expect(quickQuizDeck([], [deck("Empty", 0), deck("Real", 5)])?.name).toBe("Real");
  });

  it("treats an uncounted deck as usable — null means 'not counted', not 'empty'", () => {
    expect(quickQuizDeck([deck("Uncounted", null)], [])?.name).toBe("Uncounted");
  });

  it("returns null when there is genuinely nothing to quiz", () => {
    expect(quickQuizDeck([], [])).toBeNull();
    expect(quickQuizDeck(undefined, undefined)).toBeNull();
    expect(quickQuizDeck([deck("Empty", 0)], [deck("Also empty", 0)])).toBeNull();
  });
});

describe("quickQuizDescription", () => {
  it("names the deck, so pressing the tile holds no surprise", () => {
    expect(quickQuizDescription(deck("Japanese N4"))).toBe(
      "Multiple-choice test from Japanese N4.",
    );
  });

  it("tells a new user what to do first instead of naming a deck that isn't there", () => {
    expect(quickQuizDescription(null)).toMatch(/Import a deck first/);
  });
});
