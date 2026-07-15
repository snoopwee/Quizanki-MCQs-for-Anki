// Language detection for text-to-speech. A card can mix languages (e.g. a
// Japanese sentence followed by its Vietnamese translation), so the unit of work
// is `segmentByLang`: it splits text into contiguous runs of one language and
// tags each with a BCP-47 code, and the speaker queues one utterance per segment.
//
// Detection is script-based, with one wrinkle: Latin-script languages
// (Vietnamese, Spanish, German, English, …) all share the same script, so a Latin
// run is further classified by its diacritics. Vietnamese is the most distinctive
// (Latin Extended Additional tone marks + đ ơ ư ă), which is the case the user hit
// — without this, Vietnamese was read with an English voice.
//
// Script alone can't disambiguate CJK: bare kanji are Han characters, so a
// kana-less Japanese card reads as Chinese. To fix that, callers pass a per-face
// primary-language `hint` (from the deck/card language setting). The hint only
// overrides runs in its OWN script family (Han → ja instead of zh, or Latin →
// the chosen language), so a translation riding along in another script keeps
// its own voice.

export interface Segment {
  text: string;
  // BCP-47 primary subtag, or "" to let the browser pick its default voice.
  lang: string;
}

// Classifies a single character into a script bucket. Kana and Han share the
// "cjk" bucket on purpose: a Japanese sentence interleaves kanji (Han) and kana,
// so splitting them would shatter one sentence into many bogus segments. Spaces,
// digits and punctuation are "neutral" — they attach to whichever run surrounds
// them instead of breaking it.
function charScript(ch: string): string {
  const c = ch.codePointAt(0) ?? 0;
  if (
    (c >= 0x3040 && c <= 0x30ff) || // Hiragana + Katakana
    (c >= 0xff66 && c <= 0xff9d) || // Halfwidth Katakana
    (c >= 0x4e00 && c <= 0x9fff) || // CJK Unified Ideographs
    (c >= 0x3400 && c <= 0x4dbf) //   CJK Extension A
  )
    return "cjk";
  if (c >= 0xac00 && c <= 0xd7a3) return "ko"; // Hangul
  if (c >= 0x0400 && c <= 0x04ff) return "cyr"; // Cyrillic
  if (c >= 0x0600 && c <= 0x06ff) return "ar"; // Arabic
  if (c >= 0x0590 && c <= 0x05ff) return "he"; // Hebrew
  if (c >= 0x0370 && c <= 0x03ff) return "el"; // Greek
  if (c >= 0x0e00 && c <= 0x0e7f) return "th"; // Thai
  if (c >= 0x0900 && c <= 0x097f) return "hi"; // Devanagari
  if (
    (c >= 0x41 && c <= 0x5a) ||
    (c >= 0x61 && c <= 0x7a) || // A–Z a–z
    (c >= 0x00c0 && c <= 0x024f) || // Latin-1 + Latin Extended-A/B
    (c >= 0x1e00 && c <= 0x1eff) || // Latin Extended Additional (Vietnamese tones)
    (c >= 0x0300 && c <= 0x036f) //   combining diacritical marks
  )
    return "latin";
  return "neutral";
}

// Strong, low-false-positive Vietnamese signal: any Latin Extended Additional
// char (the toned vowels) or the distinctive ă đ ơ ư letters.
const VIETNAMESE = /[Ạ-ỿĂăĐđƠơƯư]/;
const SPANISH = /[ñ¿¡]/i;
const GERMAN = /ß/;

// Classifies a Latin-script run by its diacritics. Falls back to "" (browser
// default voice, effectively English) when there's no distinctive signal.
export function detectLatinLang(text: string): string {
  if (VIETNAMESE.test(text)) return "vi";
  if (SPANISH.test(text)) return "es";
  if (GERMAN.test(text)) return "de";
  return "";
}

// The script family a language belongs to — matches the buckets `charScript`
// produces, so a hint can be checked against a run's bucket. Anything we don't
// recognise as a specific non-Latin script is treated as Latin (en, vi, es, …).
export function scriptFamily(lang: string): string {
  const primary = lang.toLowerCase().split("-")[0];
  switch (primary) {
    case "":
      return "";
    case "ja":
    case "zh":
    case "yue":
      return "cjk";
    case "ko":
      return "ko";
    case "ru":
    case "uk":
    case "be":
    case "bg":
    case "sr":
      return "cyr";
    case "ar":
    case "fa":
    case "ur":
      return "ar";
    case "he":
      return "he";
    case "el":
      return "el";
    case "th":
      return "th";
    case "hi":
    case "mr":
    case "ne":
      return "hi";
    default:
      return "latin";
  }
}

function langForBucket(bucket: string | null, text: string, hint: string): string {
  // A same-script hint wins: it settles the ambiguous cases (Han → ja vs zh,
  // Latin → which language) without mislabelling a run in a different script.
  if (hint && bucket === scriptFamily(hint)) {
    return hint;
  }
  switch (bucket) {
    // Kana present → Japanese; otherwise a pure-Han run is taken as Chinese.
    case "cjk":
      return /[぀-ヿｦ-ﾝ]/.test(text) ? "ja" : "zh";
    case "ko":
      return "ko";
    case "cyr":
      return "ru";
    case "ar":
      return "ar";
    case "he":
      return "he";
    case "el":
      return "el";
    case "th":
      return "th";
    case "hi":
      return "hi";
    case "latin":
      return detectLatinLang(text);
    default:
      return "";
  }
}

// Splits `text` into contiguous same-language segments. Neutral characters
// (spaces, punctuation, digits) ride along with the surrounding run; adjacent
// runs that resolve to the same language are merged so we don't start a new
// utterance per word. Segments with no letters or numbers are dropped.
export function segmentByLang(text: string, hint = ""): Segment[] {
  if (!text) return [];
  // Normalise the hint to a lowercase primary subtag once (e.g. "zh-CN" → "zh").
  const h = hint ? hint.toLowerCase().split("-")[0] : "";

  type Run = { bucket: string | null; chars: string[] };
  const runs: Run[] = [];
  for (const ch of text) {
    const s = charScript(ch);
    const last = runs[runs.length - 1];
    if (s === "neutral") {
      if (last) last.chars.push(ch);
      else runs.push({ bucket: null, chars: [ch] });
    } else if (!last || (last.bucket !== null && last.bucket !== s)) {
      runs.push({ bucket: s, chars: [ch] });
    } else {
      if (last.bucket === null) last.bucket = s;
      last.chars.push(ch);
    }
  }

  const segments: Segment[] = [];
  for (const run of runs) {
    const t = run.chars.join("");
    const prev = segments[segments.length - 1];
    if (t.trim().length === 0) {
      // Trailing/leading whitespace — keep it attached to the previous segment
      // so the spoken text isn't chopped mid-pause.
      if (prev) prev.text += t;
      continue;
    }
    const lang = langForBucket(run.bucket, t, h);
    if (prev && prev.lang === lang) prev.text += t;
    else segments.push({ text: t, lang });
  }

  return segments.filter((s) => /[\p{L}\p{N}]/u.test(s.text));
}
