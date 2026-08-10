// An unsaved deck, in the moment between "we parsed your .apkg" and "save it to
// my account". The import flow used to skip this entirely — a parse went straight
// to POST /decks — so there was no point at which the user could look the deck
// over, fix a card, or decide whether to publish it.
//
// The draft reuses the flashcard editor's `EditorState` (lib/deckEditor.ts) so
// both screens share one row model and one set of pure operations.
//
// The one place this deliberately DIVERGES from `fromContents` is cloze. That
// function flattens cloze notes into plain Term/Definition rows, which is fine
// for an already-saved deck (the editor has no cloze UI). Doing the same here
// would flatten cloze on the way IN — permanently, before the deck is ever
// stored — and take the cloze quiz path (buildClozeQuestions) with it. So cloze
// note types are kept whole, with their {{c1::…}} markup left as editable text.

import type {
  ApkgNoteType,
  ApkgParseResponse,
  ImportDeckRequest,
  NoteRequest,
} from "@/types/api";
import { isBlankRow, type EditorRow, type EditorState } from "@/lib/deckEditor";
import { buildFlashcards } from "@/lib/flashcards";
import { majorityFaceLang } from "@/lib/faceLanguage";

// A parsed .apkg has no note-type ids yet (they're assigned by the backend on
// save), so rows carry a synthetic key that only has to survive until save.
export function draftNoteTypeKey(index: number): string {
  return `nt-${index}`;
}

let draftRowCounter = 0;
function nextDraftKey(): string {
  return `draft-${draftRowCounter++}`;
}

function rowsForNoteType(nt: ApkgNoteType, index: number): EditorRow[] {
  // The author's front/back layout, with a sane fallback for note types that
  // carry no card template (modern .apkg exports often don't).
  const frontFields = nt.frontFields.length > 0 ? nt.frontFields : nt.fieldNames.slice(0, 1);
  const backFields = nt.backFields.length > 0 ? nt.backFields : nt.fieldNames.slice(1, 2);

  return nt.notes.map((note) => ({
    key: nextDraftKey(),
    id: null, // nothing is persisted yet
    noteTypeId: draftNoteTypeKey(index),
    cloze: nt.cloze,
    fieldNames: nt.fieldNames,
    frontFields,
    backFields,
    fields: { ...note.fields },
    tags: [...note.tags],
    frontLang: note.frontLang ?? "",
    backLang: note.backLang ?? "",
    frontImageUrl: note.frontImageUrl ?? "",
    backImageUrl: note.backImageUrl ?? "",
  }));
}

/** Turn a freshly parsed .apkg into an editable draft. */
export function fromParsed(parsed: ApkgParseResponse): EditorState {
  const rows: EditorRow[] = [];
  const layoutByType: EditorState["layoutByType"] = {};

  parsed.noteTypes.forEach((nt, i) => {
    if (nt.fieldNames.length === 0) return; // nothing to show or save
    const key = draftNoteTypeKey(i);
    layoutByType[key] = {
      frontFields: nt.frontFields.length > 0 ? [...nt.frontFields] : nt.fieldNames.slice(0, 1),
      backFields: nt.backFields.length > 0 ? [...nt.backFields] : nt.fieldNames.slice(1, 2),
    };
    rows.push(...rowsForNoteType(nt, i));
  });

  return {
    name: parsed.filename.replace(/\.apkg$/i, "") || parsed.filename,
    rows,
    layoutByType,
  };
}

// Cards the user added in the review step have no note type of their own; they
// all land in one Basic (Front/Back) type, matching what the backend editor does.
const BASIC_TYPE_KEY = "draft-basic";

function basicNoteType(notes: NoteRequest[]): ImportDeckRequest["noteTypes"][number] {
  return {
    ankiModelId: null,
    name: "Basic",
    cloze: false,
    fieldNames: ["Front", "Back"],
    frontFields: ["Front"],
    backFields: ["Back"],
    notes,
  };
}

/**
 * The draft, as the payload `POST /decks` expects. Rows are regrouped by their
 * note type so cloze types, multi-field types and the author's front/back layout
 * all survive the round trip; blank rows are dropped; and the deck's per-face TTS
 * language is detected the same way {@link parsedToImportRequest} does it.
 */
export function draftToImportRequest(
  state: EditorState,
  options: { isPublic: boolean; sourceFilename?: string | null },
): ImportDeckRequest {
  const rows = state.rows.filter((r) => !isBlankRow(r));

  // Preserve the order note types first appeared in, so the saved deck reads the
  // same way the review screen did.
  const byType = new Map<string, EditorRow[]>();
  for (const row of rows) {
    const key = row.noteTypeId ?? BASIC_TYPE_KEY;
    const bucket = byType.get(key);
    if (bucket) {
      bucket.push(row);
    } else {
      byType.set(key, [row]);
    }
  }

  const noteTypes = [...byType.entries()].map(([key, typeRows]) => {
    const notes: NoteRequest[] = typeRows.map((r) => ({
      ankiNoteId: null,
      fields: r.fields,
      tags: r.tags,
      frontImageUrl: r.frontImageUrl || null,
      backImageUrl: r.backImageUrl || null,
    }));
    if (key === BASIC_TYPE_KEY) {
      return basicNoteType(notes);
    }
    const first = typeRows[0];
    const layout = state.layoutByType[key];
    return {
      ankiModelId: null,
      name: first.cloze ? "Cloze" : "Basic",
      cloze: first.cloze,
      fieldNames: first.fieldNames,
      frontFields: layout?.frontFields ?? first.frontFields,
      backFields: layout?.backFields ?? first.backFields,
      notes,
    };
  });

  // Detect the deck-level language from the actual card faces, so a bare-kanji
  // Japanese deck defaults to Japanese rather than Chinese.
  const cards = buildFlashcards(
    noteTypes.map((nt, i) => ({
      id: i,
      name: nt.name,
      cloze: nt.cloze,
      fieldNames: nt.fieldNames,
      frontFields: nt.frontFields,
      backFields: nt.backFields,
      noteCount: nt.notes.length,
      notes: nt.notes.map((n) => ({ ankiNoteId: null, fields: n.fields, tags: n.tags })),
    })),
  );

  return {
    name: state.name.trim(),
    subdeckPath: null,
    sourceFilename: options.sourceFilename ?? null,
    frontLang: majorityFaceLang(cards.map((c) => c.front)) || null,
    backLang: majorityFaceLang(cards.map((c) => c.back)) || null,
    isPublic: options.isPublic,
    noteTypes,
  };
}

/** Cards that would actually be saved — what the review screen's count shows. */
export function draftCardCount(state: EditorState): number {
  return state.rows.filter((r) => !isBlankRow(r)).length;
}
