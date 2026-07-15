// The language choices offered for text-to-speech, in the Flashcards Options
// modal (deck-level) and the card editor (per-card override). Codes are BCP-47
// primary subtags — what `speak`/`segmentByLang` take as a hint and what a
// SpeechSynthesis voice matches on. "" means "auto-detect" (the default), which
// falls back to the script-based detection in lib/ttsLang.
//
// This is a curated, not exhaustive, list — the languages the detector can steer
// and that common TTS voices cover. Add a row here to offer another; nothing else
// needs to change (the backend stores the code as-is).

export interface TtsLanguageOption {
  // BCP-47 primary subtag, or "" for auto-detect.
  code: string;
  label: string;
}

export const AUTO_LANGUAGE: TtsLanguageOption = { code: "", label: "Auto-detect" };

// Ordered for the dropdown: the CJK set first (the languages the auto-detect
// ambiguity actually bites), then the rest alphabetically by label.
export const TTS_LANGUAGE_OPTIONS: TtsLanguageOption[] = [
  AUTO_LANGUAGE,
  { code: "ja", label: "Japanese" },
  { code: "zh", label: "Chinese" },
  { code: "ko", label: "Korean" },
  { code: "en", label: "English" },
  { code: "vi", label: "Vietnamese" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "el", label: "Greek" },
  { code: "he", label: "Hebrew" },
  { code: "hi", label: "Hindi" },
  { code: "id", label: "Indonesian" },
  { code: "it", label: "Italian" },
  { code: "pt", label: "Portuguese" },
  { code: "ru", label: "Russian" },
  { code: "es", label: "Spanish" },
  { code: "th", label: "Thai" },
  { code: "ar", label: "Arabic" },
];

const LABEL_BY_CODE = new Map(TTS_LANGUAGE_OPTIONS.map((o) => [o.code.toLowerCase(), o.label]));

// Human label for a stored code. Falls back to the raw code (upper-cased) for a
// language not in the list, and to "Auto-detect" for the empty/auto value.
export function languageLabel(code: string | null | undefined): string {
  if (!code) return AUTO_LANGUAGE.label;
  const primary = code.toLowerCase().split("-")[0];
  return LABEL_BY_CODE.get(primary) ?? code.toUpperCase();
}
