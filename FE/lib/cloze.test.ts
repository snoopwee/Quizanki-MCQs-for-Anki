import { describe, expect, it } from "vitest";
import {
  allClozeAnswers,
  clozeAnswer,
  extractClozes,
  renderClozeFront,
  uniqueClozeIndices,
} from "@/lib/cloze";

describe("extractClozes", () => {
  it("parses a single cloze with index + answer", () => {
    const out = extractClozes("The capital of Japan is {{c1::Tokyo}}.");
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ index: 1, answer: "Tokyo", hint: undefined });
  });

  it("parses the optional hint after a second ::", () => {
    const out = extractClozes("Wear {{c1::a coat::outerwear}} in winter.");
    expect(out[0]).toMatchObject({ index: 1, answer: "a coat", hint: "outerwear" });
  });

  it("parses multiple clozes with different indices in field order", () => {
    const out = extractClozes(
      "{{c1::Tokyo}} is the capital and {{c2::yen}} is the currency.",
    );
    expect(out.map((c) => c.index)).toEqual([1, 2]);
    expect(out.map((c) => c.answer)).toEqual(["Tokyo", "yen"]);
  });

  it("returns an empty array for text with no cloze markers", () => {
    expect(extractClozes("plain text")).toEqual([]);
  });
});

describe("uniqueClozeIndices", () => {
  it("deduplicates same-index clozes in first-seen order", () => {
    expect(
      uniqueClozeIndices("{{c2::a}} {{c1::b}} {{c2::c}} {{c1::d}}"),
    ).toEqual([2, 1]);
  });
});

describe("renderClozeFront", () => {
  it("hides the active cloze with [...] and reveals others", () => {
    const text = "{{c1::Tokyo}} is the capital and {{c2::yen}} is the currency.";
    expect(renderClozeFront(text, 1)).toBe("[...] is the capital and yen is the currency.");
    expect(renderClozeFront(text, 2)).toBe("Tokyo is the capital and [...] is the currency.");
  });

  it("uses the hint when present instead of [...]", () => {
    expect(renderClozeFront("Wear {{c1::a coat::outerwear}}.", 1)).toBe("Wear [outerwear].");
  });

  it("hides every cloze that shares the active index together", () => {
    // Anki convention: two {{c1::...}} markers reveal as one card.
    const text = "{{c1::A}} and {{c1::B}} reveal together; {{c2::C}} doesn't.";
    expect(renderClozeFront(text, 1)).toBe("[...] and [...] reveal together; C doesn't.");
  });
});

describe("clozeAnswer", () => {
  it("returns the inner text for a single cloze", () => {
    expect(clozeAnswer("a {{c1::cat}} b", 1)).toBe("cat");
  });

  it("joins same-index clozes with a middle dot", () => {
    expect(clozeAnswer("{{c1::A}} and {{c1::B}}", 1)).toBe("A · B");
  });
});

describe("allClozeAnswers", () => {
  it("collects every cloze answer in source order, including repeats", () => {
    expect(
      allClozeAnswers("{{c1::Tokyo}} {{c2::yen}} {{c1::Kyoto}}"),
    ).toEqual(["Tokyo", "yen", "Kyoto"]);
  });
});
