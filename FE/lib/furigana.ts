// Parses Anki inline furigana — a base token immediately followed by its reading
// in square brackets, e.g. `食[た]べる`. Anki renders this as ruby via the
// `{{furigana:…}}` template filter; we don't run templates, so without this the
// raw `食[た]べる` leaks into every deck-text surface.
//
// The reading is constrained to KANA so ordinary bracketed text ("apple [fruit]")
// and LaTeX markers ("[latex]…[/latex]") are never mistaken for furigana. Base is
// any run of non-space, non-bracket characters up to the "[". Space-delimited word
// units are the Anki convention (`私[わたし]は 学生[がくせい]です`), so a space ends a base.

// A run of a field value: plain text, or a base with its kana reading (furigana).
export interface RubySegment {
  base: string;
  reading?: string;
}

// Fresh regex per call — a shared /g regex would carry lastIndex between uses.
// Base = a run of non-space, non-bracket chars; reading = one or more kana:
// the class spans Hiragana U+3040 (぀) through Katakana U+30FF (ヿ), which also
// covers the prolonged-sound mark ー.
function furiganaPattern(): RegExp {
  return /([^\s\[\]]+)\[([぀-ヿ]+)\]/g;
}

// Splits a value into plain and ruby segments in order. Text with no furigana
// returns a single plain segment.
export function parseFurigana(text: string): RubySegment[] {
  const segments: RubySegment[] = [];
  let last = 0;
  for (const m of text.matchAll(furiganaPattern())) {
    const idx = m.index ?? 0;
    if (idx > last) segments.push({ base: text.slice(last, idx) });
    segments.push({ base: m[1], reading: m[2] });
    last = idx + m[0].length;
  }
  if (last < text.length) segments.push({ base: text.slice(last) });
  if (segments.length === 0) segments.push({ base: text });
  return segments;
}

// Plain-text form: drop the readings, keep the base. Used for speech, written-
// answer grading, and search — none of which should see the bracketed reading.
export function stripFurigana(text: string): string {
  return text.replace(furiganaPattern(), "$1");
}
