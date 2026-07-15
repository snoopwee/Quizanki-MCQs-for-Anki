import { describe, expect, it } from "vitest";
import { detectLatinLang, scriptFamily, segmentByLang } from "@/lib/ttsLang";

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

describe("scriptFamily", () => {
  it("groups CJK languages together and Latin languages together", () => {
    expect(scriptFamily("ja")).toBe("cjk");
    expect(scriptFamily("zh")).toBe("cjk");
    expect(scriptFamily("zh-CN")).toBe("cjk"); // region tag is stripped
    expect(scriptFamily("en")).toBe("latin");
    expect(scriptFamily("vi")).toBe("latin");
    expect(scriptFamily("ru")).toBe("cyr");
    expect(scriptFamily("")).toBe("");
  });
});

describe("segmentByLang with a language hint", () => {
  it("reads bare kanji as the hinted Japanese instead of Chinese", () => {
    // The reported bug: 水 (Han, no kana) auto-detects as zh.
    expect(segmentByLang("水")).toEqual([{ text: "水", lang: "zh" }]);
    expect(segmentByLang("水", "ja")).toEqual([{ text: "水", lang: "ja" }]);
  });

  it("still lets a Chinese hint keep pure-Han as zh", () => {
    expect(segmentByLang("水", "zh")).toEqual([{ text: "水", lang: "zh" }]);
  });

  it("only overrides same-script runs — a Latin translation keeps its own voice", () => {
    // Front kanji hinted ja, but the English gloss must not be read with a JP voice.
    const segs = segmentByLang("水 water", "ja");
    expect(segs.map((s) => s.lang)).toEqual(["ja", ""]);
    expect(segs[0].text).toContain("水");
    expect(segs[1].text.trim()).toBe("water");
  });

  it("forces a Latin run to the hinted language", () => {
    expect(segmentByLang("hello", "vi")).toEqual([{ text: "hello", lang: "vi" }]);
  });

  it("ignores a hint whose script doesn't match the text", () => {
    // A ja hint on Latin text doesn't apply (different script family).
    expect(segmentByLang("hola", "ja")).toEqual([{ text: "hola", lang: "" }]);
  });
});
