import { describe, expect, it } from "vitest";
import { dominantLang, majorityFaceLang } from "@/lib/faceLanguage";

describe("dominantLang", () => {
  it("returns the language covering the most letters", () => {
    expect(dominantLang("食べる")).toBe("ja"); // kana present
    expect(dominantLang("水")).toBe("zh"); // bare Han, no hint
    expect(dominantLang("Tôi đi học")).toBe("vi");
  });

  it("returns '' for plain English / non-letter text", () => {
    expect(dominantLang("water")).toBe("");
    expect(dominantLang("123")).toBe("");
  });
});

describe("majorityFaceLang", () => {
  it("resolves a mostly-kanji Japanese deck to ja via the kana tiebreak", () => {
    // Three bare-kanji cards (each looks like zh alone) + one with kana.
    const faces = [["水"], ["火"], ["山"], ["食べる"]];
    expect(majorityFaceLang(faces)).toBe("ja");
  });

  it("keeps a kana-free Chinese deck as zh", () => {
    expect(majorityFaceLang([["你好"], ["世界"], ["水"]])).toBe("zh");
  });

  it("detects a Vietnamese face set", () => {
    expect(majorityFaceLang([["Tôi đi học"], ["nước"], ["cảm ơn"]])).toBe("vi");
  });

  it("returns '' when faces carry no detectable-language signal (English)", () => {
    expect(majorityFaceLang([["water"], ["fire"], ["mountain"]])).toBe("");
  });

  it("returns '' for an empty deck", () => {
    expect(majorityFaceLang([])).toBe("");
  });
});
