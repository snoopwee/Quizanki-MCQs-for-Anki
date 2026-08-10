import { describe, expect, it } from "vitest";
import {
  addBasicRow,
  basicRow,
  canSwapRow,
  fieldLabel,
  fromContents,
  isBlankRow,
  move,
  rowMatches,
  swapAllValues,
  swapValuesForRow,
  toPayload,
  type EditorRow,
  type EditorState,
} from "@/lib/deckEditor";
import type { DeckContentsNote, DeckContentsNoteType, DeckContentsResponse } from "@/types/api";

// Test notes may omit the per-face language fields; they default to null (auto).
type TestNote = Omit<DeckContentsNote, "frontLang" | "backLang" | "frontImageUrl" | "backImageUrl"> &
  Partial<Pick<DeckContentsNote, "frontLang" | "backLang" | "frontImageUrl" | "backImageUrl">>;

function noteType(
  over: Omit<Partial<DeckContentsNoteType>, "notes"> &
    Pick<DeckContentsNoteType, "id" | "name" | "fieldNames"> & { notes: TestNote[] },
): DeckContentsNoteType {
  return {
    ankiModelId: null,
    cloze: false,
    frontFields: ["Front"],
    backFields: ["Back"],
    noteCount: over.notes.length,
    ...over,
    notes: over.notes.map((n) => ({
      frontLang: null,
      backLang: null,
      frontImageUrl: null,
      backImageUrl: null,
      ...n,
    })),
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
    frontLang: null,
    backLang: null,
    isPublic: false,
    authorId: "u1",
    authorName: "Alice",
    authorAvatarUrl: null,
    sourceAuthorName: null,
    owned: true,
    saved: false,
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
  it("swaps cloze rows too when they have distinct front/back fields", () => {
    const row = { ...basicRow("x", "y"), cloze: true };
    expect(swapValuesForRow(row).fields).toEqual({ Front: "y", Back: "x" });
    expect(canSwapRow(row)).toBe(true);
  });

  it("is a no-op when there's no distinct back field", () => {
    const row: EditorRow = {
      ...basicRow("only", ""),
      backFields: [],
      fieldNames: ["Front"],
      fields: { Front: "only" },
    };
    expect(swapValuesForRow(row)).toBe(row);
    expect(canSwapRow(row)).toBe(false);
  });
});

describe("swapAllValues", () => {
  it("swaps term/definition values on every swappable row", () => {
    const state: EditorState = fromContents(basicDeck);
    const swapped = swapAllValues(state);
    expect(swapped.rows[0].fields).toEqual({ Front: "1", Back: "a" });
    expect(swapped.rows[1].fields).toEqual({ Front: "2", Back: "b" });
    // Layout is left as-is; it's the visible content that flips.
    expect(swapped.layoutByType.t1).toEqual({ frontFields: ["Front"], backFields: ["Back"] });
  });

  it("swaps cloze rows too (full control), but skips single-field rows", () => {
    const state: EditorState = {
      name: "d",
      rows: [
        { ...basicRow("x", "y"), cloze: true },
        { ...basicRow("only", ""), backFields: [], fieldNames: ["Front"], fields: { Front: "only" } },
      ],
      layoutByType: {},
    };
    const swapped = swapAllValues(state);
    expect(swapped.rows[0].fields).toEqual({ Front: "y", Back: "x" });
    expect(swapped.rows[1].fields).toEqual({ Front: "only" });
  });
});

describe("rowMatches", () => {
  it("matches on content with HTML stripped, case-insensitively", () => {
    const row = { ...basicRow("<b>Mitochondria</b>", "powerhouse"), fields: { Front: "<b>Mitochondria</b>", Back: "the powerhouse" } };
    expect(rowMatches(row, "mitochondria")).toBe(true);
    expect(rowMatches(row, "powerhouse")).toBe(true);
    expect(rowMatches(row, "nucleus")).toBe(false);
    // The HTML tag itself isn't matchable content.
    expect(rowMatches(row, "<b>")).toBe(false);
  });
});

describe("fieldLabel", () => {
  it("relabels Front/Back as Term/Definition, leaves others", () => {
    expect(fieldLabel("Front")).toBe("Term");
    expect(fieldLabel("back")).toBe("Definition");
    expect(fieldLabel("Meaning")).toBe("Meaning");
  });
});

describe("fromContents — cloze flattening", () => {
  const clozeDeck = deck([
    noteType({
      id: "c1",
      name: "Cloze",
      cloze: true,
      fieldNames: ["Text", "Meaning"],
      frontFields: ["Text"],
      backFields: ["Text"],
      notes: [
        {
          id: "n1",
          ankiNoteId: null,
          fields: { Text: "今日は{{c1::曇り}}ですね。", Meaning: "cloudy" },
          tags: [],
        },
      ],
    }),
  ]);

  it("turns a cloze note into a Term/Definition row, keeping its id + progress", () => {
    const state = fromContents(clozeDeck);
    expect(state.rows).toHaveLength(1);
    const row = state.rows[0];
    expect(row.id).toBe("n1"); // first deletion keeps the note id → stats preserved
    expect(row.noteTypeId).toBeNull(); // routes to Basic on save
    expect(row.cloze).toBe(false);
    expect(row.fields.Front).toBe("今日は[...]ですね。");
    expect(row.fields.Back).toBe("今日は曇りですね。\ncloudy");
  });

  it("splits a multi-deletion note into one row per index (extras kept new)", () => {
    const multi = deck([
      noteType({
        id: "c2",
        name: "Cloze",
        cloze: true,
        fieldNames: ["Text"],
        frontFields: ["Text"],
        backFields: ["Text"],
        notes: [
          {
            id: "n2",
            ankiNoteId: null,
            fields: { Text: "{{c1::A}} and {{c2::B}}" },
            tags: [],
          },
        ],
      }),
    ]);
    const rows = fromContents(multi).rows;
    expect(rows).toHaveLength(2);
    expect(rows[0].id).toBe("n2"); // first keeps id
    expect(rows[1].id).toBeNull(); // extra deletion is a new card
    expect(rows[0].fields.Front).toBe("[...] and B");
    expect(rows[1].fields.Front).toBe("A and [...]");
    expect(rows[0].fields.Back).toBe("A and B");
  });
});

describe("isBlankRow", () => {
  it("detects all-empty fields", () => {
    expect(isBlankRow(addBasicRow())).toBe(true);
    expect(isBlankRow(basicRow("", "  "))).toBe(true);
    expect(isBlankRow(basicRow("a", ""))).toBe(false);
  });
});

describe("per-face TTS language", () => {
  const langDeck = deck([
    noteType({
      id: "t1",
      name: "Basic",
      fieldNames: ["Front", "Back"],
      frontFields: ["Front"],
      backFields: ["Back"],
      notes: [
        { id: "n1", ankiNoteId: null, fields: { Front: "水", Back: "water" }, tags: [], frontLang: "ja", backLang: "en" },
      ],
    }),
  ]);

  it("carries note languages into rows and back out via toPayload", () => {
    const state = fromContents(langDeck);
    expect(state.rows[0].frontLang).toBe("ja");
    expect(state.rows[0].backLang).toBe("en");

    const payload = toPayload(state);
    expect(payload.notes[0].frontLang).toBe("ja");
    expect(payload.notes[0].backLang).toBe("en");
  });

  it("defaults a note with no languages to '' (auto-detect)", () => {
    const state = fromContents(basicDeck);
    expect(state.rows[0].frontLang).toBe("");
    expect(state.rows[0].backLang).toBe("");
  });

  it("swaps the languages along with the term/definition values", () => {
    const swapped = swapValuesForRow(fromContents(langDeck).rows[0]);
    expect(swapped.fields.Front).toBe("water");
    expect(swapped.fields.Back).toBe("水");
    expect(swapped.frontLang).toBe("en");
    expect(swapped.backLang).toBe("ja");
  });
});
