import { describe, expect, it } from "vitest";
import { cardMatchesQuery, nextAutoplayStep } from "@/lib/flashcardStudy";

describe("cardMatchesQuery", () => {
  const front = ["家 (いえ)"];
  const back = ["house, home"];

  it("matches everything on an empty or whitespace query", () => {
    expect(cardMatchesQuery(front, back, "")).toBe(true);
    expect(cardMatchesQuery(front, back, "   ")).toBe(true);
  });

  it("matches the term (front) face", () => {
    expect(cardMatchesQuery(front, back, "家")).toBe(true);
    expect(cardMatchesQuery(front, back, "いえ")).toBe(true);
  });

  it("matches the definition (back) face", () => {
    expect(cardMatchesQuery(front, back, "home")).toBe(true);
  });

  it("is case-insensitive and trims the query", () => {
    expect(cardMatchesQuery(front, back, "HOUSE")).toBe(true);
    expect(cardMatchesQuery(front, back, "  House  ")).toBe(true);
  });

  it("returns false when neither face contains the query", () => {
    expect(cardMatchesQuery(front, back, "water")).toBe(false);
  });

  it("does not leak LaTeX source into matches (stripped to [math])", () => {
    const mathFront = ["\\(\\frac{a}{b}\\)"];
    expect(cardMatchesQuery(mathFront, ["ratio"], "frac")).toBe(false);
    expect(cardMatchesQuery(mathFront, ["ratio"], "math")).toBe(true);
    expect(cardMatchesQuery(mathFront, ["ratio"], "ratio")).toBe(true);
  });

  it("does not match across the gap between separate fields", () => {
    // "家" and "house" are different fields — a query spanning both shouldn't hit.
    expect(cardMatchesQuery(["家"], ["house"], "家house")).toBe(false);
  });
});

describe("nextAutoplayStep", () => {
  it("flips to reveal the other side while still on the start side", () => {
    expect(nextAutoplayStep(true, true)).toBe("flip");
    expect(nextAutoplayStep(true, false)).toBe("flip");
  });

  it("advances once the other side has been shown and more cards remain", () => {
    expect(nextAutoplayStep(false, true)).toBe("advance");
  });

  it("stops at the last card when there's nothing left to advance to", () => {
    expect(nextAutoplayStep(false, false)).toBe("stop");
  });
});
