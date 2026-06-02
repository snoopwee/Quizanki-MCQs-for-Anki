// Pure state + operations for the flashcard editor screen. The page holds an
// `EditorState` draft and calls these helpers; nothing here touches the network,
// so it's all unit-testable. `toPayload` produces the body for
// `PUT /decks/{id}/contents` (see UpdateDeckContentsRequest).

import type { DeckContentsResponse, UpdateDeckContentsRequest } from "@/types/api";

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
// field. No-op for cloze cards or when there's no distinct front/back field.
export function swapValuesForRow(row: EditorRow): EditorRow {
  const front = row.frontFields[0];
  const back = row.backFields[0];
  if (row.cloze || !front || !back || front === back) {
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
  return !row.cloze && Boolean(front) && Boolean(back) && front !== back;
}

// Bulk "swap all front/back": flip the layout for every note type and mirror it
// onto each row (so per-card swap + any front/back labelling stay consistent).
export function swapLayoutAll(state: EditorState): EditorState {
  const layoutByType: EditorState["layoutByType"] = {};
  for (const [id, layout] of Object.entries(state.layoutByType)) {
    layoutByType[id] = {
      frontFields: [...layout.backFields],
      backFields: [...layout.frontFields],
    };
  }
  const rows = state.rows.map((r) => ({
    ...r,
    frontFields: [...r.backFields],
    backFields: [...r.frontFields],
  }));
  return { name: state.name, rows, layoutByType };
}

export function addBasicRow(): EditorRow {
  return basicRow("", "");
}

export function basicRow(front: string, back: string): EditorRow {
  return {
    key: nextKey(),
    id: null,
    noteTypeId: null,
    cloze: false,
    fieldNames: ["Front", "Back"],
    frontFields: ["Front"],
    backFields: ["Back"],
    fields: { Front: front, Back: back },
    tags: [],
  };
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
