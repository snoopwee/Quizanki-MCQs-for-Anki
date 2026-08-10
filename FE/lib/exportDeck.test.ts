import { describe, expect, it } from "vitest";
import {
  buildDelimited,
  buildQuizletText,
  exportFilename,
} from "@/lib/exportDeck";
import type { Flashcard } from "@/lib/flashcards";
import type { DeckContentsNote, DeckContentsNoteType, DeckContentsResponse } from "@/types/api";

// Test notes may omit the per-face language fields; they default to null (auto).
type TestNote = Omit<DeckContentsNote, "frontLang" | "backLang" | "frontImageUrl" | "backImageUrl"> &
  Partial<Pick<DeckContentsNote, "frontLang" | "backLang" | "frontImageUrl" | "backImageUrl">>;

function noteType(
  over: Omit<Partial<DeckContentsNoteType>, "notes"> &
    Pick<DeckContentsNoteType, "name" | "fieldNames"> & { notes: TestNote[] },
): DeckContentsNoteType {
  return {
    id: over.name,
    ankiModelId: null,
    cloze: false,
    frontFields: [],
    backFields: [],
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
    name: "JLPT N4",
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

const basic = noteType({
  name: "Basic",
  fieldNames: ["Front", "Back"],
  notes: [
    { id: "1", ankiNoteId: null, fields: { Front: "食べる", Back: "to eat" }, tags: ["N4", "verb"] },
    { id: "2", ankiNoteId: null, fields: { Front: "飲む", Back: "to drink" }, tags: [] },
  ],
});

describe("buildDelimited", () => {
  it("emits a header and one row per note (CSV)", () => {
    const csv = buildDelimited(deck([basic]), { delimiter: ",", includeTags: false });
    expect(csv).toBe("Front,Back\n食べる,to eat\n飲む,to drink\n");
  });

  it("appends a Tags column joined by spaces when includeTags", () => {
    const csv = buildDelimited(deck([basic]), { delimiter: ",", includeTags: true });
    const lines = csv.trimEnd().split("\n");
    expect(lines[0]).toBe("Front,Back,Tags");
    expect(lines[1]).toBe("食べる,to eat,N4 verb");
    expect(lines[2]).toBe("飲む,to drink,"); // empty tags -> empty cell
  });

  it("quotes cells containing the delimiter, quotes, or newlines", () => {
    const tricky = noteType({
      name: "Basic",
      fieldNames: ["Front", "Back"],
      notes: [
        {
          id: "1",
          ankiNoteId: null,
          fields: { Front: 'say "hi", now', Back: "line1\nline2" },
          tags: [],
        },
      ],
    });
    const csv = buildDelimited(deck([tricky]), { delimiter: ",", includeTags: false });
    expect(csv).toContain('"say ""hi"", now","line1\nline2"');
  });

  it("uses tabs for TSV", () => {
    const tsv = buildDelimited(deck([basic]), { delimiter: "\t", includeTags: false });
    expect(tsv.split("\n")[1]).toBe("食べる\tto eat");
  });

  it("prefixes each block with a # type comment for multi-type decks", () => {
    const second = noteType({
      name: "Cloze",
      fieldNames: ["Text"],
      cloze: true,
      notes: [{ id: "3", ankiNoteId: null, fields: { Text: "{{c1::Paris}}" }, tags: [] }],
    });
    const csv = buildDelimited(deck([basic, second]), { delimiter: ",", includeTags: false });
    expect(csv).toContain("# Basic\n");
    expect(csv).toContain("# Cloze\n");
    expect(csv).toContain("\n\n"); // blank line between blocks
  });
});

describe("buildQuizletText", () => {
  const cards: Flashcard[] = [
    { id: "1", front: ["食べる"], back: ["to eat"], noteType: "Basic" },
    { id: "2", front: ["飲む", "のむ"], back: ["to drink"], noteType: "Basic" },
  ];

  it("joins term and definition with the chosen separators", () => {
    const text = buildQuizletText(cards, { termDelimiter: "\t", rowDelimiter: "\n" });
    expect(text).toBe("食べる\tto eat\n飲む のむ\tto drink");
  });

  it("supports custom separators (comma + semicolon)", () => {
    const text = buildQuizletText(cards, { termDelimiter: ",", rowDelimiter: ";" });
    expect(text).toBe("食べる,to eat;飲む のむ,to drink");
  });
});

describe("exportFilename", () => {
  it("strips path-unsafe characters and collapses whitespace", () => {
    expect(exportFilename("JLPT N4: verbs/nouns")).toBe("JLPT_N4__verbs_nouns");
  });

  it("falls back to 'deck' when the name is blank", () => {
    expect(exportFilename("   ")).toBe("deck");
  });
});
