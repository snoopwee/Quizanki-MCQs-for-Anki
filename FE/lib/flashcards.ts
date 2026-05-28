// Turns a parsed .apkg into a flat list of browsable flashcards for the Quizlet-
// like study screen shown right after import (before any quiz setup). Each card's
// front/back mirror the deck author's card layout (template frontFields/backFields)
// when available, falling back to the detectFields heuristic — the same defaults
// the quiz setup screen uses, so what you study matches what you'll be tested on.

import { detectFields } from "@/lib/detectFields";
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

export function buildFlashcards(noteTypes: ApkgNoteType[]): Flashcard[] {
  const cards: Flashcard[] = [];

  for (const nt of noteTypes) {
    if (nt.fieldNames.length === 0) continue;
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
