import { describe, expect, it } from "vitest";
import { detectFields, selectableFields } from "@/lib/detectFields";
import type { ParsedNote } from "@/lib/parseDeck";

function notesFrom(rows: Array<[string, string]>): ParsedNote[] {
  return rows.map(([a, b]) => ({ fields: { "Field 1": a, "Field 2": b }, tags: [] }));
}

describe("detectFields", () => {
  it("detects a foreign-script prompt with high confidence (JLPT-style)", () => {
    const notes = notesFrom([
      ["食べる", "to eat"],
      ["飲む", "to drink"],
      ["行く", "to go"],
      ["見る", "to see"],
      ["話す", "to speak"],
    ]);
    const result = detectFields(notes, ["Field 1", "Field 2"]);
    expect(result.questionField).toBe("Field 1");
    expect(result.answerField).toBe("Field 2");
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it("returns low confidence for two same-script fields (triggers manual picker)", () => {
    const notes = notesFrom([
      ["apple", "a red fruit"],
      ["banana", "a yellow fruit"],
      ["cherry", "a small red fruit"],
      ["grape", "a small round fruit"],
    ]);
    const result = detectFields(notes, ["Field 1", "Field 2"]);
    expect(result.confidence).toBeLessThan(0.7);
  });

  it("returns zero confidence when only one field exists", () => {
    const notes: ParsedNote[] = [{ fields: { "Field 1": "x" }, tags: [] }];
    const result = detectFields(notes, ["Field 1"]);
    expect(result.confidence).toBe(0);
  });
});

describe("selectableFields", () => {
  // A kanji-style deck: content fields plus low-value metadata fields.
  function kanjiNotes(): ParsedNote[] {
    const levels = ["N5", "N4", "N3", "N2", "N1"];
    return Array.from({ length: 50 }, (_, i) => ({
      fields: {
        Kanji: `漢${i}`,
        English: `meaning ${i}`,
        "JLPT Level": levels[i % levels.length], // only 5 distinct values
        Components: "", // always empty
      },
      tags: [],
    }));
  }

  it("keeps high-cardinality content fields", () => {
    const result = selectableFields(kanjiNotes(), ["Kanji", "English", "JLPT Level", "Components"]);
    expect(result).toContain("Kanji");
    expect(result).toContain("English");
  });

  it("drops low-cardinality categorical metadata (e.g. JLPT Level)", () => {
    const result = selectableFields(kanjiNotes(), ["Kanji", "English", "JLPT Level", "Components"]);
    expect(result).not.toContain("JLPT Level");
  });

  it("drops mostly-empty fields", () => {
    const result = selectableFields(kanjiNotes(), ["Kanji", "English", "JLPT Level", "Components"]);
    expect(result).not.toContain("Components");
  });

  it("does not over-filter small decks where every field is low-count", () => {
    const notes = notesFrom([
      ["食べる", "to eat"],
      ["飲む", "to drink"],
      ["行く", "to go"],
    ]);
    const result = selectableFields(notes, ["Field 1", "Field 2"]);
    expect(result).toEqual(["Field 1", "Field 2"]);
  });
});
