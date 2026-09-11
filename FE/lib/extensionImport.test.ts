import { describe, it, expect } from "vitest";
import {
  EXTENSION_MSG_SOURCE,
  MAX_IMPORT_PAIRS,
  isExtensionImportMessage,
  normalizeField,
  normalizePairs,
  isSafeImageDataUrl,
  MAX_IMAGE_DATA_URL_CHARS,
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
      { front: "API", back: "Application & Programming Interface", frontImage: "", backImage: "" },
      { front: "水", back: "water", frontImage: "", backImage: "" },
    ]);
  });
  it("drops rows where BOTH sides are empty, keeps one-sided rows", () => {
    const out = normalizePairs([
      { front: "  ", back: "<br>" }, // both empty → dropped
      { front: "term", back: "" }, // kept (blank back allowed)
      { front: "", back: "def" }, // kept (blank front allowed)
    ]);
    expect(out).toEqual([
      { front: "term", back: "", frontImage: "", backImage: "" },
      { front: "", back: "def", frontImage: "", backImage: "" },
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

// --- pictures (browser-extension import) -------------------------------------

const GIF = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("isSafeImageDataUrl", () => {
  it("accepts the raster types the save path can handle", () => {
    expect(isSafeImageDataUrl(PNG)).toBe(true);
    expect(isSafeImageDataUrl(GIF)).toBe(true); // animated GIFs must survive
    expect(isSafeImageDataUrl("data:image/jpeg;base64,/9j/4AAQSkZJRg==")).toBe(true);
    expect(isSafeImageDataUrl("data:image/webp;base64,UklGRg==")).toBe(true);
  });
  it("rejects SVG, which can carry script", () => {
    expect(isSafeImageDataUrl("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=")).toBe(false);
  });
  it("rejects anything that is not an inlined raster image", () => {
    expect(isSafeImageDataUrl("https://o.quizlet.com/abc_m.jpg")).toBe(false); // remote URL
    expect(isSafeImageDataUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeImageDataUrl("data:text/html;base64,PGI+aGk8L2I+")).toBe(false);
    expect(isSafeImageDataUrl("data:image/png,notbase64")).toBe(false);
    expect(isSafeImageDataUrl("data:image/png;base64,has spaces==")).toBe(false);
    expect(isSafeImageDataUrl(undefined)).toBe(false);
    expect(isSafeImageDataUrl(123)).toBe(false);
  });
  it("rejects a picture past the size ceiling", () => {
    const huge = "data:image/png;base64," + "A".repeat(MAX_IMAGE_DATA_URL_CHARS);
    expect(isSafeImageDataUrl(huge)).toBe(false);
  });
});

describe("normalizePairs with pictures", () => {
  it("carries a valid picture through on either face", () => {
    expect(
      normalizePairs([{ front: "eye", back: "Identify A:", backImage: GIF }]),
    ).toEqual([{ front: "eye", back: "Identify A:", frontImage: "", backImage: GIF }]);
  });
  it("drops an unsafe picture but keeps the card", () => {
    expect(
      normalizePairs([
        { front: "a", back: "b", frontImage: "https://evil.example/x.png", backImage: "data:image/svg+xml;base64,PHN2Zz4=" },
      ]),
    ).toEqual([{ front: "a", back: "b", frontImage: "", backImage: "" }]);
  });
  it("keeps a picture-only card (no text on either face)", () => {
    expect(normalizePairs([{ front: "", back: "", frontImage: PNG }])).toEqual([
      { front: "", back: "", frontImage: PNG, backImage: "" },
    ]);
  });
  it("still drops a row carrying neither text nor a usable picture", () => {
    expect(normalizePairs([{ front: " ", back: "<br>", frontImage: "nope" }])).toEqual([]);
  });
});

describe("isExtensionImportMessage with pictures", () => {
  const withImg = {
    source: EXTENSION_MSG_SOURCE,
    type: "import-pairs",
    pairs: [{ front: "a", back: "b", frontImage: PNG }],
  };
  it("accepts pairs carrying optional picture fields", () => {
    expect(isExtensionImportMessage(withImg)).toBe(true);
  });
  it("rejects a non-string picture field", () => {
    expect(
      isExtensionImportMessage({ ...withImg, pairs: [{ front: "a", back: "b", frontImage: 5 }] }),
    ).toBe(false);
  });
});
