import { describe, expect, it } from "vitest";
import { plainTextToImportRequest, plainTextToParsed } from "@/lib/plainTextDeck";

const pairs = [
  { front: "a", back: "1" },
  { front: "b", back: "2" },
];

describe("plainTextToImportRequest", () => {
  it("builds a single Basic note type with null sourceFilename", () => {
    const req = plainTextToImportRequest("Biology", pairs);
    expect(req.name).toBe("Biology");
    expect(req.sourceFilename).toBeNull();
    expect(req.noteTypes).toHaveLength(1);
    const nt = req.noteTypes[0];
    expect(nt).toMatchObject({
      cloze: false,
      fieldNames: ["Front", "Back"],
      frontFields: ["Front"],
      backFields: ["Back"],
    });
    expect(nt.notes.map((n) => n.fields)).toEqual([
      { Front: "a", Back: "1" },
      { Front: "b", Back: "2" },
    ]);
  });

  it("falls back to a default name when blank", () => {
    expect(plainTextToImportRequest("   ", pairs).name).toBe("Imported deck");
  });
});

describe("plainTextToParsed", () => {
  it("produces a browseable parse result with matching counts", () => {
    const parsed = plainTextToParsed("Biology", pairs);
    expect(parsed.totalNotes).toBe(2);
    expect(parsed.noteTypes[0].noteCount).toBe(2);
    expect(parsed.noteTypes[0].notes[0].fields).toEqual({ Front: "a", Back: "1" });
  });
});
