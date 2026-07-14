// Display-only text helpers for deck content. These run at *render* time and
// never touch the values used for answer-matching -- the quiz compares the raw
// strings the backend returned, so placeholdering LaTeX or flipping text
// direction here can't change which option counts as correct.
//
// The backend's `cleanField` already strips `[sound:]`, all HTML, and decodes
// entities. What it deliberately leaves alone are two render concerns:
//   1. Text direction -- Arabic/Hebrew/Persian/Urdu decks must lay out RTL.
//   2. LaTeX markup -- math decks store raw `[latex]...` / `\(...\)` that would
//      otherwise leak as gibberish into prompts and option buttons.
//
// Direction is decided over numeric code-point ranges (not literal-char regex
// classes) so the source stays pure-ASCII and reviewable.

// Strong-RTL blocks: Hebrew, Arabic, Syriac, Arabic Supplement, Thaana,
// Arabic Extended-A, and the Hebrew/Arabic presentation forms.
function isRtl(cp: number): boolean {
  return (
    (cp >= 0x0590 && cp <= 0x05ff) ||
    (cp >= 0x0600 && cp <= 0x06ff) ||
    (cp >= 0x0700 && cp <= 0x074f) ||
    (cp >= 0x0750 && cp <= 0x077f) ||
    (cp >= 0x0780 && cp <= 0x07bf) ||
    (cp >= 0x08a0 && cp <= 0x08ff) ||
    (cp >= 0xfb1d && cp <= 0xfb4f) ||
    (cp >= 0xfb50 && cp <= 0xfdff) ||
    (cp >= 0xfe70 && cp <= 0xfeff)
  );
}

// Strong-LTR scripts: Latin (+ accented), Greek, Cyrillic, plus Kana/CJK/Hangul.
// The CJK group is directionally neutral but lays out left-to-right, so counting
// it as LTR keeps Japanese/Chinese/Korean decks from ever being mistaken for RTL.
function isLtr(cp: number): boolean {
  return (
    (cp >= 0x0041 && cp <= 0x005a) || // A-Z
    (cp >= 0x0061 && cp <= 0x007a) || // a-z
    (cp >= 0x00c0 && cp <= 0x024f) || // Latin-1 Supplement + Extended-A/B
    (cp >= 0x0370 && cp <= 0x03ff) || // Greek
    (cp >= 0x0400 && cp <= 0x04ff) || // Cyrillic
    (cp >= 0x3040 && cp <= 0x30ff) || // Hiragana + Katakana
    (cp >= 0x4e00 && cp <= 0x9fff) || // CJK Unified Ideographs
    (cp >= 0xac00 && cp <= 0xd7af) //    Hangul syllables
  );
}

/**
 * Paragraph direction for a piece of deck text, by majority of strong-directional
 * characters. Ties and text with no strong characters (digits, punctuation,
 * empty) default to `"ltr"`. Use it for a `dir` attribute on the rendered node.
 */
export function textDirection(text: string): "ltr" | "rtl" {
  let rtl = 0;
  let ltr = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp === undefined) continue;
    if (isRtl(cp)) rtl++;
    else if (isLtr(cp)) ltr++;
  }
  return rtl > ltr ? "rtl" : "ltr";
}

// Recognised LaTeX spans, longest/most-specific delimiters first so `[$$]...[/$$]`
// is consumed before the `[$]...[/$]` rule can see it. Non-greedy + `[\s\S]` so a
// span can wrap newlines without swallowing a following span.
const LATEX_SPANS: RegExp[] = [
  /\[latex\][\s\S]*?\[\/latex\]/gi,
  /\[\$\$\][\s\S]*?\[\/\$\$\]/g,
  /\[\$\][\s\S]*?\[\/\$\]/g,
  /\\\([\s\S]*?\\\)/g, // MathJax inline  \( ... \)
  /\\\[[\s\S]*?\\\]/g, // MathJax display \[ ... \]
];

/**
 * Replaces LaTeX/MathJax spans with a `[math]` placeholder for display. We can't
 * render the math, so showing a tidy marker beats leaking raw `\(\frac...\)`
 * source into a prompt or an option button. Text without LaTeX is returned
 * unchanged.
 */
export function stripLatex(text: string): string {
  return LATEX_SPANS.reduce((s, re) => s.replace(re, "[math]"), text);
}
