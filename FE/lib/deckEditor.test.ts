import { describe, expect, it } from "vitest";
import {
  addBasicRow,
  basicRow,
  canSwapRow,
  fromContents,
  isBlankRow,
  move,
  swapLayoutAll,
  swapValuesForRow,
  toPayload,
  type EditorState,
} from "@/lib/deckEditor";
import type { DeckContentsNoteType, DeckContentsResponse } from "@/types/api";

function noteType(
  over: Partial<DeckContentsNoteType> &
    Pick<DeckContentsNoteType, "id" | "name" | "fieldNames" | "notes">,
): DeckContentsNoteType {
  return {
    ankiModelId: null,
    cloze: false,
    frontFields: ["Front"],
    backFields: ["Back"],
    noteCount: over.notes.length,
    ...over,
  };
}

function deck(noteTypes: DeckContentsNoteType[]): DeckContentsResponse {
  return {
    id: "d1",
    name: "Deck",
    subdeckPath: null,
    sourceFilename: null,
    cardCount: null,
    importedAt: null,
    completion: 0,
    noteTypes,
  };
}

const basicDeck = deck([
  noteType({
    id: "t1",
    name: "Basic",
    fieldNames: ["Front", "Back"],
    frontFields: ["Front"],
    backFields: ["Back"],
    notes: [
      { id: "n1", ankiNoteId: null, fields: { Front: "a", Back: "1" }, tags: ["x"] },
      { id: "n2", ankiNoteId: null, fields: { Front: "b", Back: "2" }, tags: [] },
    ],
  }),
]);

describe("fromContents / toPayload", () => {
  it("flattens notes into rows and round-trips back to a payload", () => {
    const state = fromContents(basicDeck);
    expect(state.name).toBe("Deck");
    expect(state.rows).toHaveLength(2);
    expect(state.rows[0].id).toBe("n1");
    expect(state.layoutByType.t1).toEqual({ frontFields: ["Front"], backFields: ["Back"] });

    const payload = toPayload(state);
    expect(payload.name).toBe("Deck");
    expect(payload.notes.map((n) => n.id)).toEqual(["n1", "n2"]);
    expect(payload.noteTypes).toEqual([{ id: "t1", frontFields: ["Front"], backFields: ["Back"] }]);
  });

  it("drops blank rows on save", () => {
    const state = fromContents(basicDeck);
    state.rows.push(addBasicRow()); // empty
    const payload = toPayload(state);
    expect(payload.notes).toHaveLength(2); // the blank added row is filtered out
  });
});

describe("move", () => {
  it("reorders immutably", () => {
    expect(move([1, 2, 3], 0, 2)).toEqual([2, 3, 1]);
    expect(move([1, 2, 3], 2, 0)).toEqual([3, 1, 2]);
  });
  it("no-ops on out-of-range or same index", () => {
    const a = [1, 2, 3];
    expect(move(a, 0, 0)).toBe(a);
    expect(move(a, 0, 5)).toBe(a);
  });
});

describe("swapValuesForRow", () => {
  it("exchanges first front and back field values", () => {
    const row = basicRow("term", "definition");
    const swapped = swapValuesForRow(row);
    expect(swapped.fields).toEqual({ Front: "definition", Back: "term" });
  });
  it("is a no-op for cloze rows", () => {
    const row = { ...basicRow("x", "y"), cloze: true };
    expect(swapValuesForRow(row)).toBe(row);
    expect(canSwapRow(row)).toBe(false);
  });
});

describe("swapLayoutAll", () => {
  it("flips front/back on every note type and row", () => {
    const state: EditorState = fromContents(basicDeck);
    const swapped = swapLayoutAll(state);
    expect(swapped.layoutByType.t1).toEqual({ frontFields: ["Back"], backFields: ["Front"] });
    expect(swapped.rows[0].frontFields).toEqual(["Back"]);
    expect(swapped.rows[0].backFields).toEqual(["Front"]);
    // Values are untouched — only the layout flips.
    expect(swapped.rows[0].fields).toEqual({ Front: "a", Back: "1" });
  });
});

describe("isBlankRow", () => {
  it("detects all-empty fields", () => {
    expect(isBlankRow(addBasicRow())).toBe(true);
    expect(isBlankRow(basicRow("", "  "))).toBe(true);
    expect(isBlankRow(basicRow("a", ""))).toBe(false);
  });
});
