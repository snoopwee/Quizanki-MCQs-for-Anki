// The language choices offered for text-to-speech, in the Flashcards Options
// modal (deck-level) and the card editor (per-card override). Codes are BCP-47
// primary subtags — what `speak`/`segmentByLang` take as a hint and what a
// SpeechSynthesis voice matches on. "" means "auto-detect" (the default), which
// falls back to the script-based detection in lib/ttsLang.
//
// The `label` on each row is only a FALLBACK: `languageLabel` asks Intl.DisplayNames for the name
// in the reader's language, so this table never needs translating and a new row needs no
// catalogue entry.
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

/**
 * Human label for a stored code, in the READER'S language.
 *
 * <p>`Intl.DisplayNames` is what knows that "ja" is "Japanese" in English and "Tiếng Nhật" in
 * Vietnamese. Using it means the table above never has to be translated, and a row added to it
 * needs no catalogue entry either. The table stays as the fallback for a runtime without Intl
 * and for a code it does not recognise.
 *
 * <p>`autoLabel` is the caller's translated "Auto-detect" — this module is pure and has no
 * translator of its own.
 */
export function languageLabel(
  code: string | null | undefined,
  locale: string = "en",
  autoLabel: string = AUTO_LANGUAGE.label,
): string {
  if (!code) return autoLabel;
  const primary = code.toLowerCase().split("-")[0]!;
  try {
    const name = new Intl.DisplayNames([locale], { type: "language" }).of(primary);
    // Intl echoes the input back for a code it doesn't know; that is not a name.
    if (name && name.toLowerCase() !== primary) return name;
  } catch {
    // No Intl.DisplayNames in this runtime — fall through to the table.
  }
  return LABEL_BY_CODE.get(primary) ?? code.toUpperCase();
}

/** Every offered code with its label in `locale` — what a voice dropdown renders. */
export function languageOptions(
  locale: string,
  autoLabel: string,
): Array<{ value: string; label: string }> {
  return TTS_LANGUAGE_OPTIONS.map((o) => ({
    value: o.code,
    label: languageLabel(o.code, locale, autoLabel),
  }));
}
