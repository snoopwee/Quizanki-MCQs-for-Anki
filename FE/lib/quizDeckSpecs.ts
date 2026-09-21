// Pure deck helpers shared by the quiz setup screen and Learn: which note types can be
// asked, how many cards a subset yields, the starred / weak / mastered subsets, the
// default field picks, and the per-type specs question building consumes. Moved out of
// ApkgQuizSetup unchanged (Phase 7), so both screens select and build cards the same way.

import { detectFields } from "@/lib/detectFields";
import { detectClozeField, type NoteTypeQuizSpec, type QuizNote } from "@/lib/buildQuestions";
import { uniqueClozeIndices } from "@/lib/cloze";
import type { NoteTypeFieldPrefs, QuizPreferences } from "@/lib/quizPreferences";
import type { ApkgNoteType } from "@/types/api";

// Stats lookup used by the mastery-weighted card selection. The caller is
// responsible for sourcing the data — authed callers build it from card_stats
// returned by /decks/{id}/notes; the guest trial reads from localStorage.
// Returning undefined / a zero record both mean "treat as a new card."
export type NoteStatsLookup = (noteId: string) =>
  | { mastery: number; timesSeen: number; starred?: boolean }
  | undefined;

// A note type can power a multiple-choice quiz when:
//   - it's a cloze type with at least one cloze deletion in any note, OR
//   - it has at least two text fields (prompt + answer) and at least one note.
export function isQuizable(t: ApkgNoteType): boolean {
  if (t.noteCount === 0) return false;
  if (t.cloze) return detectClozeField(t.fieldNames, t.notes) !== null;
  return t.fieldNames.length >= 2;
}

export function cardsInType(t: ApkgNoteType): number {
  if (!t.cloze) return t.noteCount;
  const field = detectClozeField(t.fieldNames, t.notes);
  if (!field) return 0;
  let total = 0;
  for (const n of t.notes) {
    total += uniqueClozeIndices(n.fields[field] ?? "").length;
  }
  return total;
}

export function totalCardsAcrossTypes(types: ApkgNoteType[]): number {
  return types.reduce((acc, t) => acc + cardsInType(t), 0);
}

// The id a note is tracked by, matching buildFlashcards / the quiz pool: the
// persisted UUID for saved decks, else the Anki note id, else a synthetic key.
// One lookup then serves the flashcard list, the quiz, and starred selection.
export function noteKey(noteType: ApkgNoteType, note: ApkgNoteType["notes"][number], i: number): string {
  return note.id ?? note.ankiNoteId ?? `${noteType.id}-${i}`;
}

function buildPool(
  noteType: ApkgNoteType,
  getStats: NoteStatsLookup | undefined,
): QuizNote[] {
  return noteType.notes.map((n, i) => {
    const id = noteKey(noteType, n, i);
    const stats = getStats?.(id);
    return {
      id,
      fields: n.fields,
      mastery: stats?.mastery ?? 0,
      timesSeen: stats?.timesSeen ?? 0,
    };
  });
}

// Every note key across the given types.
export function collectAllNoteIds(types: ApkgNoteType[]): Set<string> {
  const ids = new Set<string>();
  for (const nt of types) {
    nt.notes.forEach((n, i) => ids.add(noteKey(nt, n, i)));
  }
  return ids;
}

// Note keys the user has starred, across every quizable type. Empty when there's
// no stats lookup (guest with no stars yet, or a caller that doesn't track them).
export function collectStarredIds(
  types: ApkgNoteType[],
  getStats: NoteStatsLookup | undefined,
): Set<string> {
  const ids = new Set<string>();
  if (!getStats) return ids;
  for (const nt of types) {
    nt.notes.forEach((n, i) => {
      if (getStats(noteKey(nt, n, i))?.starred) ids.add(noteKey(nt, n, i));
    });
  }
  return ids;
}

// Note keys the learner has seen but not yet mastered (mastery < 80). The
// "Still learning" source draws from these. Empty without a stats lookup, or
// for a learner who hasn't answered anything yet.
export function collectWeakIds(
  types: ApkgNoteType[],
  getStats: NoteStatsLookup | undefined,
): Set<string> {
  const ids = new Set<string>();
  if (!getStats) return ids;
  for (const nt of types) {
    nt.notes.forEach((n, i) => {
      const key = noteKey(nt, n, i);
      const stats = getStats(key);
      if (stats && stats.timesSeen > 0 && stats.mastery < 80) ids.add(key);
    });
  }
  return ids;
}

// Note keys already mastered: seen, mastery 80+ — the Mastered stage in masteryStage.ts.
// Learn's "Include mastered cards: off" leaves these out.
export function collectMasteredIds(
  types: ApkgNoteType[],
  getStats: NoteStatsLookup | undefined,
): Set<string> {
  const ids = new Set<string>();
  if (!getStats) return ids;
  for (const nt of types) {
    nt.notes.forEach((n, i) => {
      const key = noteKey(nt, n, i);
      const stats = getStats(key);
      if (stats && stats.timesSeen > 0 && stats.mastery >= 80) ids.add(key);
    });
  }
  return ids;
}

// How many quiz cards a given id subset yields — a cloze note still contributes
// one card per deletion, mirroring cardsInType.
export function countCardsIn(types: ApkgNoteType[], idSet: Set<string>): number {
  let total = 0;
  for (const nt of types) {
    const clozeField = nt.cloze ? detectClozeField(nt.fieldNames, nt.notes) : null;
    nt.notes.forEach((n, i) => {
      if (!idSet.has(noteKey(nt, n, i))) return;
      total += clozeField ? uniqueClozeIndices(n.fields[clozeField] ?? "").length : 1;
    });
  }
  return total;
}

export function initialPrefsForType(
  nt: ApkgNoteType,
  saved: QuizPreferences | null,
): NoteTypeFieldPrefs {
  const restored = restoreFieldPrefs(saved?.fieldPrefs[String(nt.id)], nt.fieldNames);
  if (restored) return restored;
  const detection = detectFields(nt.notes, nt.fieldNames);
  const answerField = nt.backFields[0] ?? detection.answerField ?? nt.fieldNames[1] ?? "";
  const questionFields =
    nt.frontFields.length > 0
      ? nt.frontFields
      : detection.questionField
        ? [detection.questionField]
        : [];
  return {
    questionFields: questionFields.filter((f) => f !== answerField),
    answerField,
  };
}

export function initialPrefsByType(
  basicTypes: ApkgNoteType[],
  saved: QuizPreferences | null,
): Record<string, NoteTypeFieldPrefs> {
  const out: Record<string, NoteTypeFieldPrefs> = {};
  for (const nt of basicTypes) {
    out[String(nt.id)] = initialPrefsForType(nt, saved);
  }
  return out;
}

function restoreFieldPrefs(
  saved: NoteTypeFieldPrefs | undefined,
  liveFields: string[],
): NoteTypeFieldPrefs | null {
  if (!saved) return null;
  const live = new Set(liveFields);
  if (!live.has(saved.answerField)) return null;
  const questionFields = saved.questionFields.filter(
    (f) => live.has(f) && f !== saved.answerField,
  );
  if (questionFields.length === 0) return null;
  return { questionFields, answerField: saved.answerField };
}

export function buildAllCardsSpecs(
  quizable: ApkgNoteType[],
  perTypePrefs: Record<string, NoteTypeFieldPrefs>,
  getStats: NoteStatsLookup | undefined,
): NoteTypeQuizSpec[] {
  const specs: NoteTypeQuizSpec[] = [];
  for (const nt of quizable) {
    const pool = buildPool(nt, getStats);
    if (nt.cloze) {
      const textField = detectClozeField(nt.fieldNames, nt.notes);
      if (!textField) continue;
      specs.push({ kind: "cloze", noteTypeId: String(nt.id), textField, notes: pool });
      continue;
    }
    const prefs = perTypePrefs[String(nt.id)];
    if (!prefs || prefs.questionFields.length === 0 || !prefs.answerField) continue;
    specs.push({
      kind: "basic",
      noteTypeId: String(nt.id),
      questionFields: prefs.questionFields,
      answerField: prefs.answerField,
      notes: pool,
    });
  }
  return specs;
}
