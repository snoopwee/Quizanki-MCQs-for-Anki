// Pure state + operations for the flashcard editor screen. The page holds an
// `EditorState` draft and calls these helpers; nothing here touches the network,
// so it's all unit-testable. `toPayload` produces the body for
// `PUT /decks/{id}/contents` (see UpdateDeckContentsRequest).

import type {
  DeckContentsNote,
  DeckContentsResponse,
  UpdateDeckContentsRequest,
} from "@/types/api";
import { detectClozeField } from "@/lib/buildQuestions";
import { renderClozeBack, renderClozeFront, uniqueClozeIndices } from "@/lib/cloze";

export interface EditorRow {
  // Stable local key for React lists — survives reorder/edit (note id may be null).
  key: string;
  id: string | null; // persisted note id; null for a freshly added/imported card
  // Original Anki note id — kept so an imported row can be matched to its parsed
  // audio ref (for review-time playback). Null for manual / cloze-split rows.
  ankiNoteId: string | null;
  noteTypeId: string | null; // null → backend routes to the Basic (Front/Back) type
  cloze: boolean;
  fieldNames: string[];
  frontFields: string[];
  backFields: string[];
  fields: Record<string, string>;
  tags: string[];
  // Per-face TTS language override (BCP-47 primary subtag); "" = inherit the deck
  // default. Edited via the per-field "voice" menu; round-trips through save.
  frontLang: string;
  backLang: string;
  // Per-face card image URL; "" = no image. Set in the card editor, round-trips
  // through the bulk save.
  frontImageUrl: string;
  backImageUrl: string;
  // Per-face card audio URL; "" = no audio. Same lifecycle as the images.
  frontAudioUrl: string;
  backAudioUrl: string;
}

export interface EditorState {
  name: string;
  rows: EditorRow[];
  // Per-note-type front/back layout, flipped by swapLayoutAll and sent on save.
  layoutByType: Record<string, { frontFields: string[]; backFields: string[] }>;
}

let keyCounter = 0;
function nextKey(): string {
  return `row-${keyCounter++}`;
}

export function fromContents(contents: DeckContentsResponse): EditorState {
  const rows: EditorRow[] = [];
  const layoutByType: EditorState["layoutByType"] = {};
  for (const nt of contents.noteTypes) {
    layoutByType[nt.id] = {
      frontFields: [...nt.frontFields],
      backFields: [...nt.backFields],
    };

    // Cloze cards are flattened into plain Term/Definition rows so they're
    // editable like everything else (the editor has no cloze-specific UI). On
    // save these route to the Basic type (noteTypeId left null) — the first
    // deletion keeps the original note id (and its study progress); extra
    // deletions in the same note become new cards.
    const clozeField = nt.cloze ? detectClozeField(nt.fieldNames, nt.notes) : null;
    if (clozeField) {
      const extraFields = nt.fieldNames.filter((f) => f !== clozeField);
      for (const note of nt.notes) {
        rows.push(...clozeNoteToRows(note, clozeField, extraFields));
      }
      continue;
    }

    for (const note of nt.notes) {
      rows.push({
        key: nextKey(),
        id: note.id,
        ankiNoteId: note.ankiNoteId,
        noteTypeId: nt.id,
        cloze: nt.cloze,
        fieldNames: nt.fieldNames,
        frontFields: nt.frontFields,
        backFields: nt.backFields,
        fields: { ...note.fields },
        tags: [...note.tags],
        frontLang: note.frontLang ?? "",
        backLang: note.backLang ?? "",
        frontImageUrl: note.frontImageUrl ?? "",
        backImageUrl: note.backImageUrl ?? "",
        frontAudioUrl: note.frontAudioUrl ?? "",
        backAudioUrl: note.backAudioUrl ?? "",
      });
    }
  }
  return { name: contents.name, rows, layoutByType };
}

// Flatten one cloze note into Term/Definition rows. Term = the sentence with the
// active deletion blanked to "[…]" (or "[hint]"); Definition = the full sentence
// with every deletion revealed, plus any non-cloze fields (translations/notes)
// on following lines. e.g. "今日は{{c1::曇り}}ですね。" → Term "今日は[…]ですね。",
// Definition "今日は曇りですね。" (+ "cloudy" if it lives in an extra field).
function clozeNoteToRows(
  note: DeckContentsNote,
  clozeField: string,
  extraFields: string[],
): EditorRow[] {
  const text = note.fields[clozeField] ?? "";
  const extras = extraFields
    .map((f) => note.fields[f] ?? "")
    .filter((v) => v.trim().length > 0);
  const indices = uniqueClozeIndices(text);

  // Cloze type but this note has no deletion — keep its text as the term. All
  // rows from one note inherit that note's per-face language override.
  const fl = note.frontLang ?? "";
  const bl = note.backLang ?? "";
  if (indices.length === 0) {
    return [rowWithId(note.id, text, extras.join("\n"), note.tags, fl, bl)];
  }

  const definition = [renderClozeBack(text), ...extras]
    .filter((v) => v.trim().length > 0)
    .join("\n");
  return indices.map((idx, i) =>
    rowWithId(i === 0 ? note.id : null, renderClozeFront(text, idx), definition, note.tags, fl, bl),
  );
}

// Immutable move of one row from index `from` to index `to`.
export function move<T>(arr: T[], from: number, to: number): T[] {
  if (from === to || to < 0 || to >= arr.length || from < 0 || from >= arr.length) {
    return arr;
  }
  const copy = [...arr];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

// Per-card swap: exchange the values of the first front field and first back
// field. No-op only when there's no distinct front/back field to swap (e.g. a
// single-field card). Cloze cards are included — the user gets full control.
export function swapValuesForRow(row: EditorRow): EditorRow {
  const front = row.frontFields[0];
  const back = row.backFields[0];
  if (!front || !back || front === back) {
    return row;
  }
  return {
    ...row,
    fields: {
      ...row.fields,
      [front]: row.fields[back] ?? "",
      [back]: row.fields[front] ?? "",
    },
    // The languages, images and audio follow their text to the other side.
    frontLang: row.backLang,
    backLang: row.frontLang,
    frontImageUrl: row.backImageUrl,
    backImageUrl: row.frontImageUrl,
    frontAudioUrl: row.backAudioUrl,
    backAudioUrl: row.frontAudioUrl,
  };
}

export function canSwapRow(row: EditorRow): boolean {
  const front = row.frontFields[0];
  const back = row.backFields[0];
  return Boolean(front) && Boolean(back) && front !== back;
}

// Bulk "swap all front/back": swap the term/definition *values* of every
// swappable card — the same exchange as the per-card swap, applied to the whole
// deck. Cloze cards and single-field cards are left untouched (swapValuesForRow
// no-ops them), and the layout is intentionally left as-is so the visible
// content actually flips (the previous layout-only flip changed nothing on
// screen, which read as "not working").
export function swapAllValues(state: EditorState): EditorState {
  return { ...state, rows: state.rows.map(swapValuesForRow) };
}

// Plain-text view of a row's content (HTML stripped, whitespace collapsed,
// lower-cased) so the editor search matches the words the user actually reads
// rather than the underlying markup.
export function rowSearchText(row: EditorRow): string {
  return Object.values(row.fields)
    .join(" ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// True when the row's content contains the (already lower-cased) query.
export function rowMatches(row: EditorRow, query: string): boolean {
  return rowSearchText(row).includes(query);
}

export function addBasicRow(): EditorRow {
  return basicRow("", "");
}

export function basicRow(front: string, back: string): EditorRow {
  return rowWithId(null, front, back, []);
}

// A Basic (Front/Back) row carrying an explicit note id and tags — used when
// converting an existing cloze note so its study progress is preserved on save.
function rowWithId(
  id: string | null,
  front: string,
  back: string,
  tags: string[],
  frontLang = "",
  backLang = "",
): EditorRow {
  return {
    key: nextKey(),
    id,
    ankiNoteId: null,
    noteTypeId: null,
    cloze: false,
    fieldNames: ["Front", "Back"],
    frontFields: ["Front"],
    backFields: ["Back"],
    fields: { Front: front, Back: back },
    tags: [...tags],
    frontLang,
    backLang,
    frontImageUrl: "",
    backImageUrl: "",
    frontAudioUrl: "",
    backAudioUrl: "",
  };
}

// Human label for a field in the editor: Anki's Basic "Front"/"Back" read as
// "Term"/"Definition" (the Quizlet vocabulary used across import/export); any
// other field name is shown as-is.
export function fieldLabel(name: string): string {
  const key = name.trim().toLowerCase();
  if (key === "front") return "Term";
  if (key === "back") return "Definition";
  return name;
}

// Field names that are empty across EVERY card of their note type — dedicated
// media holders (an "Audio" field that was just [sound:...], an "Image_URI" that
// was just <img>, both cleaned to "") and other unused fields. The editor hides
// their textareas: they're pure media (already shown in the Media section) or
// carry no data, so an empty box for them is just noise. Keyed by note type
// (noteTypeId, "" for the Basic/manual bucket) so a field is hidden for all cards
// of a type or none — never per-card. Purely visual; the field map is untouched.
export function emptyFieldsByType(rows: EditorRow[]): Map<string, Set<string>> {
  const byType = new Map<string, EditorRow[]>();
  for (const row of rows) {
    const key = row.noteTypeId ?? "";
    const group = byType.get(key);
    if (group) group.push(row);
    else byType.set(key, [row]);
  }

  const result = new Map<string, Set<string>>();
  for (const [key, group] of byType) {
    const empty = new Set<string>();
    for (const field of group[0]?.fieldNames ?? []) {
      if (group.every((r) => !(r.fields[field] ?? "").trim())) empty.add(field);
    }
    result.set(key, empty);
  }
  return result;
}

// Split a note type's fields into the card's Term (front) side, its Definition
// (back) side, and everything else ("other" — fields the card layout doesn't put
// on either face, e.g. an id / metadata field). Order within each group follows
// the note type's field order. Used to lay the editor out by side and to group the
// field-visibility modal.
export interface FieldGroups {
  term: string[];
  definition: string[];
  other: string[];
}

// The distinct note types present in a set of editor rows, with each type's fields
// and front/back layout — enough to drive the field-visibility modal from a draft
// (which, unlike saved-deck contents, has no separate note-type list).
export interface RowNoteType {
  id: string;
  fieldNames: string[];
  frontFields: string[];
  backFields: string[];
}

export function noteTypesFromRows(rows: EditorRow[]): RowNoteType[] {
  const byId = new Map<string, RowNoteType>();
  for (const row of rows) {
    const id = row.noteTypeId ?? "";
    if (!byId.has(id)) {
      byId.set(id, {
        id,
        fieldNames: row.fieldNames,
        frontFields: row.frontFields,
        backFields: row.backFields,
      });
    }
  }
  return [...byId.values()];
}

export function groupFields(
  fieldNames: string[],
  frontFields: string[],
  backFields: string[],
): FieldGroups {
  const front = new Set(frontFields);
  const back = new Set(backFields);
  const groups: FieldGroups = { term: [], definition: [], other: [] };
  for (const f of fieldNames) {
    if (front.has(f)) groups.term.push(f);
    else if (back.has(f)) groups.definition.push(f);
    else groups.other.push(f);
  }
  return groups;
}

// A row with no content in any field AND no image AND no audio — dropped on save
// so stray empty cards (e.g. an "Add card" the user never filled in) don't
// persist. A card carrying only an image or only audio is NOT blank.
export function isBlankRow(row: EditorRow): boolean {
  const noText = row.fieldNames.every((f) => !(row.fields[f] ?? "").trim());
  return (
    noText &&
    !row.frontImageUrl &&
    !row.backImageUrl &&
    !row.frontAudioUrl &&
    !row.backAudioUrl
  );
}

export function toPayload(state: EditorState): UpdateDeckContentsRequest {
  const noteTypes = Object.entries(state.layoutByType).map(([id, layout]) => ({
    id,
    frontFields: layout.frontFields,
    backFields: layout.backFields,
  }));
  const notes = state.rows
    .filter((r) => !isBlankRow(r))
    .map((r) => ({
      id: r.id,
      noteTypeId: r.noteTypeId,
      fields: r.fields,
      tags: r.tags,
      frontLang: r.frontLang,
      backLang: r.backLang,
      frontImageUrl: r.frontImageUrl,
      backImageUrl: r.backImageUrl,
      frontAudioUrl: r.frontAudioUrl,
      backAudioUrl: r.backAudioUrl,
    }));
  return { name: state.name.trim(), noteTypes, notes };
}
