// Turns a parsed .apkg into a flat list of browsable flashcards for the Quizlet-
// like study screen shown right after import (before any quiz setup). Each card's
// front/back mirror the deck author's card layout (template frontFields/backFields)
// when available, falling back to the detectFields heuristic — the same defaults
// the quiz setup screen uses, so what you study matches what you'll be tested on.
//
// Cloze note types take a different path: each unique {{c<n>::...}} index in a
// note becomes its own card (the Anki convention), with the active cloze hidden
// on the front and every cloze revealed in context on the back. Extra non-cloze
// fields (translations, notes) ride along on the back as supporting context.

import { detectFields } from "@/lib/detectFields";
import { detectClozeField } from "@/lib/buildQuestions";
import { renderClozeBack, renderClozeFront, uniqueClozeIndices } from "@/lib/cloze";
import type { ApkgNoteType } from "@/types/api";

export interface Flashcard {
  id: string;
  // One entry per non-empty field, so the UI can render each on its own line.
  front: string[];
  back: string[];
  noteType: string;
  // Per-card TTS language override per face (BCP-47 primary subtag), or null to
  // inherit the deck default. Only set for saved decks; a fresh parse leaves both
  // null. Cloze cards from one note share the note's languages.
  frontLang?: string | null;
  backLang?: string | null;
  // Per-face card image URL (null = none), shown alongside the text on that face.
  frontImageUrl?: string | null;
  backImageUrl?: string | null;
  // Per-face card audio URL (null = none), played by the in-card speaker (which
  // prefers a stored clip over TTS when present).
  frontAudioUrl?: string | null;
  backAudioUrl?: string | null;
}

function bundle(fields: Record<string, string>, names: string[]): string[] {
  return names.map((n) => fields[n] ?? "").filter((v) => v.length > 0);
}

function buildClozeCards(nt: ApkgNoteType): Flashcard[] {
  const clozeField = detectClozeField(nt.fieldNames, nt.notes);
  if (!clozeField) return [];

  // Every non-cloze field with content shows up on the back as supporting
  // context (e.g. a translation or an "Extra" field).
  const extraFields = nt.fieldNames.filter((f) => f !== clozeField);

  const out: Flashcard[] = [];
  nt.notes.forEach((note, i) => {
    const text = note.fields[clozeField] ?? "";
    const indices = uniqueClozeIndices(text);
    const id = note.id ?? note.ankiNoteId ?? `${nt.id}-${i}`;

    if (indices.length === 0) {
      // Cloze type but this note has no cloze deletion — show it plainly so
      // the user can still browse it instead of silently dropping the note.
      const front = text.length > 0 ? [text] : [];
      const back = bundle(note.fields, extraFields);
      if (front.length === 0 && back.length === 0) return;
      out.push({
        id,
        front,
        back,
        noteType: nt.name,
        frontLang: note.frontLang ?? null,
        backLang: note.backLang ?? null,
      });
      return;
    }

    const revealed = renderClozeBack(text);
    const extras = bundle(note.fields, extraFields);
    for (const idx of indices) {
      out.push({
        id,
        front: [renderClozeFront(text, idx)],
        // Full sentence with every cloze revealed, then any extra fields below.
        back: [revealed, ...extras],
        noteType: nt.name,
        frontLang: note.frontLang ?? null,
        backLang: note.backLang ?? null,
      });
    }
  });
  return out;
}

export function buildFlashcards(noteTypes: ApkgNoteType[]): Flashcard[] {
  const cards: Flashcard[] = [];

  for (const nt of noteTypes) {
    if (nt.fieldNames.length === 0) continue;

    if (nt.cloze) {
      cards.push(...buildClozeCards(nt));
      continue;
    }

    const detection = detectFields(nt.notes, nt.fieldNames);

    const frontFields =
      nt.frontFields.length > 0
        ? nt.frontFields
        : detection.questionField
          ? [detection.questionField]
          : [nt.fieldNames[0]];

    const backFields =
      nt.backFields.length > 0
        ? nt.backFields
        : detection.answerField && detection.answerField !== detection.questionField
          ? [detection.answerField]
          : nt.fieldNames.slice(1, 2);

    nt.notes.forEach((note, i) => {
      const front = bundle(note.fields, frontFields);
      const back = bundle(note.fields, backFields);
      const frontImageUrl = note.frontImageUrl ?? null;
      const backImageUrl = note.backImageUrl ?? null;
      const frontAudioUrl = note.frontAudioUrl ?? null;
      const backAudioUrl = note.backAudioUrl ?? null;
      // Nothing to show only when there's no text AND no image AND no audio.
      if (
        front.length === 0 &&
        back.length === 0 &&
        !frontImageUrl &&
        !backImageUrl &&
        !frontAudioUrl &&
        !backAudioUrl
      )
        return;
      cards.push({
        // Mirror the id scheme ApkgQuizSetup uses for the quiz pool: persisted
        // UUID first (saved decks), then ankiNoteId, then a synthetic key. This
        // lets one getStats lookup serve both the flashcard list and the quiz.
        id: note.id ?? note.ankiNoteId ?? `${nt.id}-${i}`,
        front,
        back,
        noteType: nt.name,
        frontLang: note.frontLang ?? null,
        backLang: note.backLang ?? null,
        frontImageUrl,
        backImageUrl,
        frontAudioUrl,
        backAudioUrl,
      });
    });
  }

  return cards;
}
