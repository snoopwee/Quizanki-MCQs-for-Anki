import { describe, expect, it } from "vitest";
import {
  DEFAULT_LEARN_PREFS,
  LEARN_MIN_CARDS,
  effectiveLearnCount,
  sanitizeLearnPreferences,
} from "@/lib/learnPreferences";

describe("sanitizeLearnPreferences", () => {
  it("rejects a stored value that isn't an object", () => {
    expect(sanitizeLearnPreferences(null)).toBeNull();
    expect(sanitizeLearnPreferences("5")).toBeNull();
  });

  it("fills every missing setting with its default", () => {
    expect(sanitizeLearnPreferences({})).toEqual(DEFAULT_LEARN_PREFS);
  });

  it("keeps valid saved settings", () => {
    const saved = {
      count: 12,
      kinds: ["written", "mcq"],
      answerWith: "term",
      starredOnly: true,
      includeMastered: false,
      shuffle: false,
      retryMissed: false,
      retypeWrong: true,
      smartGrading: false,
      readAloud: true,
    };
    // Kinds come back in canonical order.
    expect(sanitizeLearnPreferences(saved)).toEqual({ ...saved, kinds: ["mcq", "written"] });
  });

  it("brings missed cards back by default, including for settings saved before the option", () => {
    expect(DEFAULT_LEARN_PREFS.retryMissed).toBe(true);
    expect(sanitizeLearnPreferences({ count: 8, shuffle: false })?.retryMissed).toBe(true);
  });

  it("never stores a card count below the minimum", () => {
    expect(sanitizeLearnPreferences({ count: 2 })?.count).toBe(LEARN_MIN_CARDS);
    expect(sanitizeLearnPreferences({ count: 7.9 })?.count).toBe(7);
    expect(sanitizeLearnPreferences({ count: Number.NaN })?.count).toBe(LEARN_MIN_CARDS);
  });

  it("falls back to multiple choice when no known question type is saved", () => {
    expect(sanitizeLearnPreferences({ kinds: ["flashcards", 3] })?.kinds).toEqual(["mcq"]);
  });

  it("treats an unknown answer side as the definition", () => {
    expect(sanitizeLearnPreferences({ answerWith: "both" })?.answerWith).toBe("definition");
  });
});

describe("effectiveLearnCount", () => {
  it("uses the typed count when it fits", () => {
    expect(effectiveLearnCount(8, 40)).toBe(8);
  });

  it("raises a count below the minimum to 5", () => {
    expect(effectiveLearnCount(3, 40)).toBe(5);
    expect(effectiveLearnCount(0, 40)).toBe(5);
  });

  it("uses the minimum for a blank entry", () => {
    expect(effectiveLearnCount(Number.NaN, 40)).toBe(5);
  });

  it("caps at the cards available", () => {
    expect(effectiveLearnCount(50, 12)).toBe(12);
  });

  it("uses every card when the deck has fewer than the minimum", () => {
    expect(effectiveLearnCount(5, 3)).toBe(3);
  });

  it("is 0 when nothing is available", () => {
    expect(effectiveLearnCount(5, 0)).toBe(0);
  });
});
