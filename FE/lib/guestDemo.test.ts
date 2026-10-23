import { describe, expect, it } from "vitest";
import {
  buildGuestPresetQuiz,
  guestDemoKey,
  hasUsedDemo,
  GUEST_DEMO_QUESTIONS,
} from "./guestDemo";
import type { ApkgNoteType, ApkgParseResponse, ApkgParsedNote } from "@/types/api";

function note(front: string, back: string): ApkgParsedNote {
  return { ankiNoteId: front, fields: { Front: front, Back: back }, tags: [] };
}

function basicType(count: number, id = 1): ApkgNoteType {
  const notes = Array.from({ length: count }, (_, i) => note(`Term ${i}`, `Definition ${i}`));
  return {
    id,
    name: "Basic",
    cloze: false,
    fieldNames: ["Front", "Back"],
    frontFields: ["Front"],
    backFields: ["Back"],
    noteCount: notes.length,
    notes,
  };
}

function deck(types: ApkgNoteType[], filename = "deck.apkg"): ApkgParseResponse {
  return {
    filename,
    collectionFile: "",
    schema: "",
    totalNotes: types.reduce((n, t) => n + t.notes.length, 0),
    skippedNotes: 0,
    imageOnlyNotes: 0,
    noteTypes: types,
  } as ApkgParseResponse;
}

describe("guestDemoKey", () => {
  it("keys a shared deck by its id", () => {
    expect(guestDemoKey({ kind: "shared", deckId: "abc-123" })).toBe("shared:abc-123");
  });

  it("keys an uploaded file by name and size, so re-uploading it is the same deck", () => {
    const a = guestDemoKey({ kind: "upload", filename: "JLPT_N4.apkg", noteCount: 400 });
    const b = guestDemoKey({ kind: "upload", filename: "JLPT_N4.apkg", noteCount: 400 });
    expect(a).toBe(b);
  });

  it("treats a different upload as a different deck", () => {
    const a = guestDemoKey({ kind: "upload", filename: "JLPT_N4.apkg", noteCount: 400 });
    const b = guestDemoKey({ kind: "upload", filename: "JLPT_N5.apkg", noteCount: 400 });
    // Same name, different size — an edited deck is still a different deck.
    const c = guestDemoKey({ kind: "upload", filename: "JLPT_N4.apkg", noteCount: 401 });
    expect(new Set([a, b, c]).size).toBe(3);
  });

  it("namespaces the two kinds so they can never collide", () => {
    // An uploaded file could be named anything, including something that looks like a deck id.
    const shared = guestDemoKey({ kind: "shared", deckId: "x" });
    const upload = guestDemoKey({ kind: "upload", filename: "x", noteCount: 0 });
    expect(shared).not.toBe(upload);
  });
});

describe("hasUsedDemo", () => {
  it("is false for a deck never studied", () => {
    expect(hasUsedDemo({}, "shared:a")).toBe(false);
  });

  it("is true once the deck's run is recorded", () => {
    expect(hasUsedDemo({ "shared:a": 1 }, "shared:a")).toBe(true);
  });

  it("is per deck — using one does not spend another", () => {
    const used = { "shared:a": 1 };
    expect(hasUsedDemo(used, "shared:b")).toBe(false);
  });

  it("is not fooled by inherited object properties", () => {
    // `"constructor" in used` would be true for any object; the demo must not think a deck
    // called "constructor" has been used.
    expect(hasUsedDemo({}, "constructor")).toBe(false);
    expect(hasUsedDemo({}, "toString")).toBe(false);
  });
});

describe("buildGuestPresetQuiz", () => {
  it("asks the preset number of questions when the deck is big enough", () => {
    const questions = buildGuestPresetQuiz(deck([basicType(50)]));
    expect(questions).toHaveLength(GUEST_DEMO_QUESTIONS);
  });

  it("never asks for more questions than the deck has cards", () => {
    const questions = buildGuestPresetQuiz(deck([basicType(4)]));
    expect(questions).toHaveLength(4);
  });

  it("builds multiple-choice only — picking formats is what an account buys", () => {
    const questions = buildGuestPresetQuiz(deck([basicType(20)]));
    expect(questions.length).toBeGreaterThan(0);
    expect(new Set(questions.map((q) => q.kind))).toEqual(new Set(["mcq"]));
  });

  it("detects the question and answer fields with no setup screen", () => {
    const questions = buildGuestPresetQuiz(deck([basicType(20)]));
    const q = questions[0]!;
    // Front asks, Back answers — the same pairing the setup screen defaults to.
    expect(q.correct).toMatch(/^Definition \d+$/);
    expect(JSON.stringify(q.prompt)).toMatch(/Term \d+/);
  });

  it("is deterministic given a fixed rng, so the preset can be tested at all", () => {
    const fixed = () => 0.42;
    const a = buildGuestPresetQuiz(deck([basicType(20)]), { rng: fixed });
    const b = buildGuestPresetQuiz(deck([basicType(20)]), { rng: fixed });
    expect(a.map((q) => q.correct)).toEqual(b.map((q) => q.correct));
  });

  it("returns nothing for a deck with no quizable note type", () => {
    // One field only: there is no question/answer pair to make, so there is no demo.
    const unusable: ApkgNoteType = {
      id: 9,
      name: "Single",
      cloze: false,
      fieldNames: ["Only"],
      frontFields: [],
      backFields: [],
      noteCount: 1,
      notes: [{ ankiNoteId: "1", fields: { Only: "lonely" }, tags: [] }],
    };
    expect(buildGuestPresetQuiz(deck([unusable]))).toEqual([]);
  });

  it("returns nothing for an empty deck rather than starting a blank session", () => {
    expect(buildGuestPresetQuiz(deck([]))).toEqual([]);
    expect(buildGuestPresetQuiz(deck([basicType(0)]))).toEqual([]);
  });
});
