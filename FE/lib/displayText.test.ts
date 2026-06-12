import { describe, it, expect } from "vitest";
import { textDirection, stripLatex } from "./displayText";

// Build sample non-Latin strings from code points so the assertions don't depend
// on literal-character fidelity in this source file.
const cp = (...codes: number[]) => String.fromCodePoint(...codes);
const ARABIC = cp(0x0627, 0x0644, 0x0639, 0x0631, 0x0628, 0x064a, 0x0629); // "al-arabiya"
const HEBREW = cp(0x05e2, 0x05d1, 0x05e8, 0x05d9, 0x05ea); // "ivrit"
const JAPANESE = cp(0x6f22, 0x5b57); // CJK "kanji"
const KANA = cp(0x3053, 0x3093, 0x306b, 0x3061, 0x306f); // "konnichiwa"
const CYRILLIC = cp(0x043f, 0x0440, 0x0438, 0x0432, 0x0435, 0x0442); // "privet"

describe("textDirection", () => {
  it("defaults to ltr for empty / whitespace / digits-only text", () => {
    expect(textDirection("")).toBe("ltr");
    expect(textDirection("   ")).toBe("ltr");
    expect(textDirection("12345 - 67%")).toBe("ltr");
  });

  it("returns ltr for Latin, CJK, kana, and Cyrillic", () => {
    expect(textDirection("hello world")).toBe("ltr");
    expect(textDirection(JAPANESE)).toBe("ltr");
    expect(textDirection(KANA)).toBe("ltr");
    expect(textDirection(CYRILLIC)).toBe("ltr");
  });

  it("returns rtl for Arabic and Hebrew", () => {
    expect(textDirection(ARABIC)).toBe("rtl");
    expect(textDirection(HEBREW)).toBe("rtl");
  });

  it("picks direction by majority of strong characters in mixed text", () => {
    expect(textDirection(ARABIC + " ok")).toBe("rtl"); // mostly Arabic
    expect(textDirection("the word is " + ARABIC)).toBe("ltr"); // mostly Latin
  });

  it("breaks an even split toward ltr", () => {
    expect(textDirection(cp(0x0627) + "a")).toBe("ltr"); // 1 RTL + 1 LTR
  });
});

describe("stripLatex", () => {
  it("leaves text without LaTeX unchanged", () => {
    expect(stripLatex("just plain text")).toBe("just plain text");
    expect(stripLatex("")).toBe("");
    expect(stripLatex("a [bracket] that is not latex")).toBe("a [bracket] that is not latex");
  });

  it("replaces [latex]...[/latex], case-insensitively", () => {
    expect(stripLatex("a [latex]\\frac{1}{2}[/latex] b")).toBe("a [math] b");
    expect(stripLatex("[LaTeX]x^2[/LaTeX]")).toBe("[math]");
  });

  it("replaces MathJax inline and display delimiters", () => {
    expect(stripLatex("x = \\(a+b\\) here")).toBe("x = [math] here");
    expect(stripLatex("\\[E=mc^2\\]")).toBe("[math]");
  });

  it("replaces [$]...[/$] and [$$]...[/$$]", () => {
    expect(stripLatex("[$]a[/$]")).toBe("[math]");
    expect(stripLatex("[$$]a[/$$]")).toBe("[math]");
  });

  it("replaces every span in a string and spans across newlines", () => {
    expect(stripLatex("\\(a\\) and \\(b\\)")).toBe("[math] and [math]");
    expect(stripLatex("[latex]line1\nline2[/latex]")).toBe("[math]");
  });
});
