import { describe, expect, it } from "vitest";
import { detectFields } from "@/lib/detectFields";
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
