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

  it("expands cloze notes into one card per unique cloze index", () => {
    const cards = buildFlashcards([
      noteType({
        id: 10,
        name: "Cloze",
        cloze: true,
        fieldNames: ["Text", "English"],
        notes: [
          note({ Text: "毎朝、{{c1::コーヒー}}を飲みます。", English: "coffee" }),
          note({ Text: "{{c1::Tokyo}} is the capital and {{c2::yen}} is the currency.", English: "" }),
        ],
      }),
    ]);

    // First note has one cloze → one card; second has two → two cards.
    expect(cards).toHaveLength(3);

    const coffee = cards[0];
    expect(coffee.front).toEqual(["毎朝、[...]を飲みます。"]);
    // Back reveals the cloze in context, with the translation field below.
    expect(coffee.back).toEqual(["毎朝、コーヒーを飲みます。", "coffee"]);

    const tokyoCard = cards[1];
    expect(tokyoCard.front).toEqual(["[...] is the capital and yen is the currency."]);
    expect(tokyoCard.back[0]).toBe("Tokyo is the capital and yen is the currency.");
  });

  it("never leaks raw {{c<n>::...}} markers in cloze flashcard output", () => {
    const cards = buildFlashcards([
      noteType({
        id: 11,
        cloze: true,
        fieldNames: ["Text"],
        notes: [note({ Text: "彼女は{{c1::医者}}になりたいです。" })],
      }),
    ]);
    for (const c of cards) {
      for (const line of [...c.front, ...c.back]) {
        expect(line).not.toMatch(/\{\{c\d+::/);
      }
    }
  });

  it("uses the hint when the cloze has one", () => {
    const cards = buildFlashcards([
      noteType({
        id: 12,
        cloze: true,
        fieldNames: ["Text"],
        notes: [note({ Text: "Wear {{c1::a coat::outerwear}}." })],
      }),
    ]);
    expect(cards[0].front).toEqual(["Wear [outerwear]."]);
    expect(cards[0].back[0]).toBe("Wear a coat.");
  });

  it("falls back to plain text for cloze notes mixed with no-cloze notes", () => {
    // A cloze type where one note has a marker (so detectClozeField finds it)
    // and another has none — the second should still appear, rendered plainly.
    const cards = buildFlashcards([
      noteType({
        id: 13,
        cloze: true,
        fieldNames: ["Text", "Extra"],
        notes: [
          note({ Text: "Hot drink: {{c1::coffee}}", Extra: "" }),
          note({ Text: "no cloze here", Extra: "footnote" }),
        ],
      }),
    ]);
    expect(cards).toHaveLength(2);
    expect(cards[0].front).toEqual(["Hot drink: [...]"]);
    expect(cards[1].front).toEqual(["no cloze here"]);
    expect(cards[1].back).toEqual(["footnote"]);
  });

  it("skips a cloze note type whose notes have no cloze markers at all", () => {
    // The BE flagged the type as cloze but nothing inside actually is — the
    // type isn't quizzable and shouldn't pollute the flashcard list.
    const cards = buildFlashcards([
      noteType({
        id: 14,
        cloze: true,
        fieldNames: ["Text"],
        notes: [note({ Text: "broken note, no cloze" })],
      }),
    ]);
    expect(cards).toHaveLength(0);
  });
});
