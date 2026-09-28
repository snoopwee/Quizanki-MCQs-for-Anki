import { describe, expect, it } from "vitest";
import { OG_SIZE, initialsOf, ogTitleSize } from "./ogText";

describe("OG card", () => {
  it("is the 1200x630 every platform crops to", () => {
    // Off-size images get letterboxed or centre-cropped; this is the one both X and Facebook want.
    expect(OG_SIZE).toEqual({ width: 1200, height: 630 });
  });
});

describe("initialsOf", () => {
  it("takes two letters from one word, and one from each of two", () => {
    expect(initialsOf("hoangtester")).toBe("HO");
    expect(initialsOf("Mai Tran")).toBe("MT");
    expect(initialsOf("  mai   tran  ")).toBe("MT");
  });

  it("falls back rather than rendering an empty circle", () => {
    expect(initialsOf("")).toBe("?");
    expect(initialsOf("   ")).toBe("?");
    expect(initialsOf(null)).toBe("?");
    expect(initialsOf(undefined)).toBe("?");
  });
});

describe("ogTitleSize", () => {
  it("steps down for long names instead of overflowing the card", () => {
    // Satori has no line-clamp, and deck names like
    // "Japanese_Core_2000_Step_01_Listening_Sentence_Vocab__Images" are the common case.
    expect(ogTitleSize("Kana")).toBe(82);
    expect(ogTitleSize("a".repeat(50))).toBe(66);
    expect(ogTitleSize("Japanese_Core_2000_Step_01_Listening_Sentence_Vocab__Images")).toBe(66);
    expect(ogTitleSize("a".repeat(100))).toBe(54);
  });
});
