// Guessing a deck's primary TTS language per face (term / definition). Run once
// when a deck is imported (to seed decks.front_lang / back_lang) and as a live
// fallback for decks saved before the language feature existed.
//
// The whole point is to fix the CJK ambiguity at the DECK level: a Japanese deck
// is full of cards, and while any single bare-kanji card looks like Chinese, the
// deck as a whole almost always has kana somewhere — so the majority vote plus a
// "kana anywhere ⇒ Japanese" tiebreak lands on ja. The result is a best-effort
// default; the user can override it in the Flashcards Options modal.

import { segmentByLang } from "@/lib/ttsLang";

// Hiragana, katakana, halfwidth katakana — the unambiguous "this is Japanese"
// signal (Chinese has none of these).
const KANA = /[぀-ヿｦ-ﾝ]/;

// The dominant language of one face's text: the language covering the most
// letters across its detected segments. "" when nothing is detectable (plain
// English / digits) — such a face abstains from the vote.
export function dominantLang(text: string): string {
  const segments = segmentByLang(text);
  if (segments.length === 0) return "";
  const lettersByLang = new Map<string, number>();
  for (const seg of segments) {
    const letters = (seg.text.match(/\p{L}/gu) ?? []).length;
    lettersByLang.set(seg.lang, (lettersByLang.get(seg.lang) ?? 0) + letters);
  }
  let best = "";
  let bestLetters = -1;
  for (const [lang, letters] of lettersByLang) {
    if (letters > bestLetters) {
      best = lang;
      bestLetters = letters;
    }
  }
  return best;
}

/**
 * The majority primary language across a set of faces (one string[] per card).
 * ja and zh compete as a single CJK bloc — decided by kana presence — so a deck
 * of mostly bare kanji still resolves to Japanese if any card has kana. Returns
 * "" when no face carries a detectable-language signal (e.g. an English side).
 */
export function majorityFaceLang(faces: string[][]): string {
  const counts = new Map<string, number>();
  let cjkVotes = 0;
  let hasKana = false;

  for (const face of faces) {
    const text = face.join(". ");
    if (KANA.test(text)) hasKana = true;
    const lang = dominantLang(text);
    if (!lang) continue; // undetermined faces (plain English) don't vote
    counts.set(lang, (counts.get(lang) ?? 0) + 1);
    if (lang === "ja" || lang === "zh") cjkVotes++;
  }

  // Best non-CJK contender (CJK is tallied as one bloc below).
  let bestLang = "";
  let bestCount = 0;
  for (const [lang, count] of counts) {
    if (lang === "ja" || lang === "zh") continue;
    if (count > bestCount) {
      bestLang = lang;
      bestCount = count;
    }
  }

  // CJK wins ties — the ambiguous script is exactly what this is meant to pin
  // down — and kana anywhere in the bloc means Japanese, else Chinese.
  if (cjkVotes > 0 && cjkVotes >= bestCount) {
    return hasKana ? "ja" : "zh";
  }
  return bestLang;
}
