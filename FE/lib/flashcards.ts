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
      out.push({ id, front, back, noteType: nt.name });
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
      if (front.length === 0 && back.length === 0) return; // nothing to show
      cards.push({
        // Mirror the id scheme ApkgQuizSetup uses for the quiz pool: persisted
        // UUID first (saved decks), then ankiNoteId, then a synthetic key. This
        // lets one getStats lookup serve both the flashcard list and the quiz.
        id: note.id ?? note.ankiNoteId ?? `${nt.id}-${i}`,
        front,
        back,
        noteType: nt.name,
      });
    });
  }

  return cards;
}
