import { describe, expect, it } from "vitest";
import { buildFlashcards } from "@/lib/flashcards";
import type { ApkgNoteType, ApkgParsedNote } from "@/types/api";

function note(fields: Record<string, string>): ApkgParsedNote {
  return { ankiNoteId: null, fields, tags: [] };
}

function noteType(over: Partial<ApkgNoteType> & Pick<ApkgNoteType, "id" | "fieldNames" | "notes">): ApkgNoteType {
  return {
    name: "Type",
    cloze: false,
    frontFields: [],
    backFields: [],
    noteCount: over.notes.length,
    ...over,
  };
}

describe("buildFlashcards", () => {
  it("uses template front/back fields when present", () => {
    const cards = buildFlashcards([
      noteType({
        id: 1,
        name: "Vocab",
        fieldNames: ["Word", "Reading", "Meaning"],
        frontFields: ["Word", "Reading"],
        backFields: ["Meaning"],
        notes: [note({ Word: "猫", Reading: "ねこ", Meaning: "cat" })],
      }),
    ]);
    expect(cards).toHaveLength(1);
    expect(cards[0].front).toEqual(["猫", "ねこ"]);
    expect(cards[0].back).toEqual(["cat"]);
    expect(cards[0].noteType).toBe("Vocab");
  });

  it("falls back to the detection heuristic when there is no template", () => {
    const cards = buildFlashcards([
      noteType({
        id: 2,
        fieldNames: ["Field 1", "Field 2"],
        notes: [
          note({ "Field 1": "食べる", "Field 2": "to eat" }),
          note({ "Field 1": "飲む", "Field 2": "to drink" }),
        ],
      }),
    ]);
    // Foreign-script field becomes the front, translation the back.
    expect(cards[0].front).toEqual(["食べる"]);
    expect(cards[0].back).toEqual(["to eat"]);
  });

  it("flattens cards across multiple note types and skips empty ones", () => {
    const cards = buildFlashcards([
      noteType({ id: 1, fieldNames: ["F", "B"], frontFields: ["F"], backFields: ["B"], notes: [note({ F: "a", B: "x" })] }),
      noteType({ id: 2, fieldNames: ["F", "B"], frontFields: ["F"], backFields: ["B"], notes: [note({ F: "", B: "" })] }),
    ]);
    expect(cards).toHaveLength(1);
    expect(cards[0].front).toEqual(["a"]);
  });
});
