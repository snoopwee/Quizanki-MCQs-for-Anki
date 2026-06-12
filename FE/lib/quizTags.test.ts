import { describe, it, expect } from "vitest";
import { collectTags, idsWithAnyTag, intersectIds } from "./quizTags";
import type { ApkgNoteType, ApkgParsedNote } from "@/types/api";

// Minimal note-type fixture: only the fields the tag helpers read (notes + tags).
function noteType(id: number, notes: Array<{ id: string; tags: string[] }>): ApkgNoteType {
  return {
    id,
    name: `type-${id}`,
    cloze: false,
    fieldNames: ["Front", "Back"],
    frontFields: [],
    backFields: [],
    noteCount: notes.length,
    notes: notes.map<ApkgParsedNote>((n) => ({
      id: n.id,
      ankiNoteId: null,
      fields: { Front: "q", Back: "a" },
      tags: n.tags,
    })),
  };
}

// The id the quiz pool tracks a note by, matching ApkgQuizSetup's noteKey.
const keyOf = (_nt: ApkgNoteType, n: ApkgParsedNote, i: number) =>
  n.id ?? n.ankiNoteId ?? `synthetic-${i}`;

describe("collectTags", () => {
  it("returns the distinct tags across all note types, sorted", () => {
    const types = [
      noteType(1, [
        { id: "a", tags: ["verb", "n5"] },
        { id: "b", tags: ["noun", "n5"] },
      ]),
      noteType(2, [{ id: "c", tags: ["verb", "n4"] }]),
    ];
    expect(collectTags(types)).toEqual(["n4", "n5", "noun", "verb"]);
  });

  it("ignores empty tag strings and untagged notes", () => {
    const types = [
      noteType(1, [
        { id: "a", tags: [""] },
        { id: "b", tags: [] },
        { id: "c", tags: ["kanji"] },
      ]),
    ];
    expect(collectTags(types)).toEqual(["kanji"]);
  });
});

describe("idsWithAnyTag", () => {
  const types = [
    noteType(1, [
      { id: "a", tags: ["verb", "n5"] },
      { id: "b", tags: ["noun"] },
      { id: "c", tags: ["verb"] },
    ]),
  ];

  it("matches notes carrying ANY selected tag (union)", () => {
    const ids = idsWithAnyTag(types, new Set(["verb"]), keyOf);
    expect([...ids].sort()).toEqual(["a", "c"]);
  });

  it("unions across multiple selected tags", () => {
    const ids = idsWithAnyTag(types, new Set(["noun", "n5"]), keyOf);
    expect([...ids].sort()).toEqual(["a", "b"]);
  });

  it("returns an empty set when nothing is selected", () => {
    expect(idsWithAnyTag(types, new Set(), keyOf).size).toBe(0);
  });
});

describe("intersectIds", () => {
  it("treats null as 'no constraint'", () => {
    const s = new Set(["a", "b"]);
    expect(intersectIds(null, s)).toBe(s);
    expect(intersectIds(s, null)).toBe(s);
    expect(intersectIds(null, null)).toBeNull();
  });

  it("intersects two non-null sets", () => {
    const a = new Set(["a", "b", "c"]);
    const b = new Set(["b", "c", "d"]);
    expect([...intersectIds(a, b)!].sort()).toEqual(["b", "c"]);
  });

  it("yields an empty set when the constraints are disjoint", () => {
    const out = intersectIds(new Set(["a"]), new Set(["b"]));
    expect(out).not.toBeNull();
    expect(out!.size).toBe(0);
  });
});
