// Persists the quiz setup form across visits so a learner who picks "Word +
// Reading → 5 questions" once doesn't have to re-derive it every time they
// come back to the same deck. localStorage-only; we never want to ship this
// to the BE (the next device might prefer a different layout).
//
// Schema versioning lives in the storage key — bumping the version forces a
// clean slate without us having to write migration code for stale shapes.
// v1 stored a selectedNoteTypeKey (the user's pick from a dropdown); v2
// removed that dropdown and always runs in mixed-all-cards mode, so v1 data
// no longer fits and we start fresh.

const STORAGE_PREFIX = "quizanki:quiz-prefs:v2:";

/** Per-note-type field choices. Only basic note types use this; cloze types
 * have no field picker, so they have nothing to remember. */
export interface NoteTypeFieldPrefs {
  questionFields: string[];
  answerField: string;
}

export interface QuizPreferences {
  count: number;
  /** Keyed by note-type id (stringified). Empty when the user hasn't
   * customized any basic type's field picks. */
  fieldPrefs: Record<string, NoteTypeFieldPrefs>;
}

function key(deckId: string): string {
  return `${STORAGE_PREFIX}${deckId}`;
}

/** Best-effort localStorage read; SSR / disabled storage just returns null. */
export function loadQuizPreferences(deckId: string): QuizPreferences | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key(deckId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return sanitize(parsed);
  } catch {
    // Quota errors, malformed JSON, or a privacy-mode storage that throws on
    // read all collapse to "no prefs" — caller falls back to defaults.
    return null;
  }
}

export function saveQuizPreferences(deckId: string, prefs: QuizPreferences): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key(deckId), JSON.stringify(prefs));
  } catch {
    // localStorage can throw on quota or in private mode; preferences are
    // strictly nice-to-have so we swallow rather than break the quiz start.
  }
}

/** Normalises an untrusted parsed value into a usable QuizPreferences, or
 * null when the stored shape can't be salvaged. The caller still has to
 * validate field references against the live deck (a deck re-import can
 * rename fields or change note-type ids). */
function sanitize(value: unknown): QuizPreferences | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const count = typeof v.count === "number" && Number.isFinite(v.count) ? v.count : 10;
  const rawPrefs = v.fieldPrefs;
  const fieldPrefs: Record<string, NoteTypeFieldPrefs> = {};
  if (rawPrefs && typeof rawPrefs === "object") {
    for (const [k, raw] of Object.entries(rawPrefs as Record<string, unknown>)) {
      if (!raw || typeof raw !== "object") continue;
      const entry = raw as Record<string, unknown>;
      const questionFields = Array.isArray(entry.questionFields)
        ? entry.questionFields.filter((f): f is string => typeof f === "string")
        : [];
      const answerField = typeof entry.answerField === "string" ? entry.answerField : "";
      if (answerField.length === 0) continue;
      fieldPrefs[k] = { questionFields, answerField };
    }
  }
  return { count, fieldPrefs };
}
