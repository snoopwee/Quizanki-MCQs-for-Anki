import { describe, it, expect } from "vitest";
import {
  EXTENSION_MSG_SOURCE,
  MAX_IMPORT_PAIRS,
  isExtensionImportMessage,
  normalizeField,
  normalizePairs,
} from "./extensionImport";

describe("isExtensionImportMessage", () => {
  const good = {
    source: EXTENSION_MSG_SOURCE,
    type: "import-pairs",
    pairs: [{ front: "a", back: "b" }],
  };
  it("accepts a well-formed message", () => {
    expect(isExtensionImportMessage(good)).toBe(true);
    expect(isExtensionImportMessage({ ...good, name: "Set" })).toBe(true);
  });
  it("rejects wrong source / type / shapes", () => {
    expect(isExtensionImportMessage({ ...good, source: "evil" })).toBe(false);
    expect(isExtensionImportMessage({ ...good, type: "other" })).toBe(false);
    expect(isExtensionImportMessage({ ...good, pairs: "nope" })).toBe(false);
    expect(isExtensionImportMessage({ ...good, pairs: [{ front: "a" }] })).toBe(false); // back missing
    expect(isExtensionImportMessage({ ...good, pairs: [{ front: 1, back: 2 }] })).toBe(false);
    expect(isExtensionImportMessage(null)).toBe(false);
    expect(isExtensionImportMessage("string")).toBe(false);
  });
});

describe("normalizeField", () => {
  it("strips tags, turns <br> into a space, collapses whitespace, trims", () => {
    expect(normalizeField("  <b>Hello</b>\n  world  ")).toBe("Hello world");
    expect(normalizeField("line1<br>line2")).toBe("line1 line2");
    expect(normalizeField("a<br/>b<BR />c")).toBe("a b c");
  });
  it("decodes named and numeric HTML entities", () => {
    expect(normalizeField("Tom &amp; Jerry")).toBe("Tom & Jerry");
    expect(normalizeField("&lt;tag&gt;")).toBe("<tag>");
    expect(normalizeField("caf&#233;")).toBe("café");
    expect(normalizeField("it&#x2019;s")).toBe("it’s");
    expect(normalizeField("a&nbsp;b")).toBe("a b");
  });
  it("leaves plain text (incl. CJK) untouched", () => {
    expect(normalizeField("水 = water")).toBe("水 = water");
  });
  it("leaves an unknown entity alone rather than mangling it", () => {
    expect(normalizeField("100&fake;200")).toBe("100&fake;200");
  });
});

describe("normalizePairs", () => {
  it("cleans both faces and preserves order", () => {
    expect(
      normalizePairs([
        { front: "<i>API</i>", back: "Application &amp; Programming Interface" },
        { front: "水", back: "water" },
      ]),
    ).toEqual([
      { front: "API", back: "Application & Programming Interface" },
      { front: "水", back: "water" },
    ]);
  });
  it("drops rows where BOTH sides are empty, keeps one-sided rows", () => {
    const out = normalizePairs([
      { front: "  ", back: "<br>" }, // both empty → dropped
      { front: "term", back: "" }, // kept (blank back allowed)
      { front: "", back: "def" }, // kept (blank front allowed)
    ]);
    expect(out).toEqual([
      { front: "term", back: "" },
      { front: "", back: "def" },
    ]);
  });
  it("caps at MAX_IMPORT_PAIRS", () => {
    const many = Array.from({ length: MAX_IMPORT_PAIRS + 50 }, (_, i) => ({
      front: `t${i}`,
      back: `d${i}`,
    }));
    expect(normalizePairs(many)).toHaveLength(MAX_IMPORT_PAIRS);
  });
});
