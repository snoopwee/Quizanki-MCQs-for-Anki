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
  noteTypeId: string | null; // null → backend routes to the Basic (Front/Back) type
  cloze: boolean;
  fieldNames: string[];
  frontFields: string[];
  backFields: string[];
  fields: Record<string, string>;
  tags: string[];
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
        noteTypeId: nt.id,
        cloze: nt.cloze,
        fieldNames: nt.fieldNames,
        frontFields: nt.frontFields,
        backFields: nt.backFields,
        fields: { ...note.fields },
        tags: [...note.tags],
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

  // Cloze type but this note has no deletion — keep its text as the term.
  if (indices.length === 0) {
    return [rowWithId(note.id, text, extras.join("\n"), note.tags)];
  }

  const definition = [renderClozeBack(text), ...extras]
    .filter((v) => v.trim().length > 0)
    .join("\n");
  return indices.map((idx, i) =>
    rowWithId(i === 0 ? note.id : null, renderClozeFront(text, idx), definition, note.tags),
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
): EditorRow {
  return {
    key: nextKey(),
    id,
    noteTypeId: null,
    cloze: false,
    fieldNames: ["Front", "Back"],
    frontFields: ["Front"],
    backFields: ["Back"],
    fields: { Front: front, Back: back },
    tags: [...tags],
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

// A row with no content in any field — dropped on save so stray empty cards
// (e.g. an "Add card" the user never filled in) don't persist.
export function isBlankRow(row: EditorRow): boolean {
  return row.fieldNames.every((f) => !(row.fields[f] ?? "").trim());
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
    }));
  return { name: state.name.trim(), noteTypes, notes };
}
