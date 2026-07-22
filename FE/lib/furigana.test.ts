import { describe, expect, it } from "vitest";
import { parseFurigana, stripFurigana } from "@/lib/furigana";

describe("parseFurigana", () => {
  it("returns a single plain segment for text with no furigana", () => {
    expect(parseFurigana("hello world")).toEqual([{ base: "hello world" }]);
    expect(parseFurigana("")).toEqual([{ base: "" }]);
  });

  it("splits a base + kana reading into a ruby segment", () => {
    expect(parseFurigana("食[た]べる")).toEqual([
      { base: "食", reading: "た" },
      { base: "べる" },
    ]);
  });

  it("handles multiple space-delimited furigana words with plain text between", () => {
    expect(parseFurigana("私[わたし]は 学生[がくせい]です")).toEqual([
      { base: "私", reading: "わたし" },
      { base: "は " },
      { base: "学生", reading: "がくせい" },
      { base: "です" },
    ]);
  });

  it("ignores non-kana bracketed text (ordinary brackets / LaTeX markers)", () => {
    expect(parseFurigana("apple [fruit]")).toEqual([{ base: "apple [fruit]" }]);
    expect(parseFurigana("[latex]x^2[/latex]")).toEqual([{ base: "[latex]x^2[/latex]" }]);
  });
});

describe("stripFurigana", () => {
  it("keeps the base and drops the reading", () => {
    expect(stripFurigana("食[た]べる")).toBe("食べる");
    expect(stripFurigana("私[わたし]は 学生[がくせい]です")).toBe("私は 学生です");
  });

  it("leaves text without furigana untouched", () => {
    expect(stripFurigana("hello")).toBe("hello");
    expect(stripFurigana("apple [fruit]")).toBe("apple [fruit]");
    expect(stripFurigana("[latex]x^2[/latex]")).toBe("[latex]x^2[/latex]");
  });
});
