import { describe, expect, it } from "vitest";
import { detectLatinLang, segmentByLang } from "@/lib/ttsLang";

describe("detectLatinLang", () => {
  it("detects Vietnamese from its diacritics", () => {
    expect(detectLatinLang("Tôi đi học")).toBe("vi"); // đ
    expect(detectLatinLang("Xin chào các bạn")).toBe("vi"); // à, ạ
    expect(detectLatinLang("nước")).toBe("vi"); // ướ
  });

  it("detects Spanish and German signals", () => {
    expect(detectLatinLang("¿Mañana?")).toBe("es");
    expect(detectLatinLang("Straße")).toBe("de");
  });

  it("returns '' for plain Latin / English (browser default voice)", () => {
    expect(detectLatinLang("hello world")).toBe("");
    expect(detectLatinLang("a simple sentence")).toBe("");
  });
});

describe("segmentByLang", () => {
  it("keeps a Japanese sentence (kanji + kana) as one ja segment", () => {
    // Han + kana must NOT split into zh/ja fragments.
    const segs = segmentByLang("私は学生です");
    expect(segs).toEqual([{ text: "私は学生です", lang: "ja" }]);
  });

  it("reads a pure-Han run as Chinese", () => {
    expect(segmentByLang("你好世界")).toEqual([{ text: "你好世界", lang: "zh" }]);
  });

  it("speaks a Vietnamese (Latin) sentence as vi, not English", () => {
    expect(segmentByLang("Tôi đi học")).toEqual([{ text: "Tôi đi học", lang: "vi" }]);
  });

  it("splits a mixed Japanese-then-Vietnamese card into ordered segments", () => {
    // Real Japanese has kana, which pins the CJK run to ja (kanji-only would be zh).
    const segs = segmentByLang("これは日本語です。 Tôi đi học");
    expect(segs.map((s) => s.lang)).toEqual(["ja", "vi"]);
    expect(segs[0].text).toContain("日本語");
    expect(segs[1].text).toContain("Tôi");
  });

  it("merges adjacent same-language runs and ignores punctuation-only pieces", () => {
    const segs = segmentByLang("hello, world!");
    expect(segs).toEqual([{ text: "hello, world!", lang: "" }]);
  });

  it("returns [] for empty / non-letter input", () => {
    expect(segmentByLang("")).toEqual([]);
    expect(segmentByLang("   ")).toEqual([]);
  });
});
