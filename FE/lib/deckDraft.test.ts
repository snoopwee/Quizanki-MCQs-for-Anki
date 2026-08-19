import { describe, expect, it } from "vitest";
import { draftCardCount, draftToImportRequest, fromParsed } from "@/lib/deckDraft";
import { addBasicRow, basicRow } from "@/lib/deckEditor";
import type { ApkgNoteType, ApkgParseResponse } from "@/types/api";

function noteType(over: Partial<ApkgNoteType>): ApkgNoteType {
  return {
    id: 1,
    name: "Basic",
    cloze: false,
    fieldNames: ["Front", "Back"],
    frontFields: ["Front"],
    backFields: ["Back"],
    noteCount: 0,
    notes: [],
    ...over,
  };
}

function parsed(noteTypes: ApkgNoteType[], filename = "JLPT N4.apkg"): ApkgParseResponse {
  return {
    filename,
    collectionFile: "collection.anki2",
    schema: "legacy",
    totalNotes: noteTypes.reduce((n, t) => n + t.notes.length, 0),
    skippedNotes: 0,
    imageOnlyNotes: 0,
    noteTypes,
  };
}

const basic = noteType({
  notes: [
    { ankiNoteId: "1", fields: { Front: "食べる", Back: "to eat" }, tags: ["N4"] },
    { ankiNoteId: "2", fields: { Front: "飲む", Back: "to drink" }, tags: [] },
  ],
});

const cloze = noteType({
  id: 2,
  name: "Cloze",
  cloze: true,
  fieldNames: ["Text", "Extra"],
  frontFields: ["Text"],
  backFields: ["Extra"],
  notes: [
    { ankiNoteId: "3", fields: { Text: "今日は{{c1::曇り}}ですね。", Extra: "cloudy" }, tags: [] },
  ],
});

describe("fromParsed", () => {
  it("names the deck after the file, without the extension", () => {
    expect(fromParsed(parsed([basic])).name).toBe("JLPT N4");
  });

  it("carries every note over as an unsaved row", () => {
    const draft = fromParsed(parsed([basic]));
    expect(draft.rows).toHaveLength(2);
    expect(draft.rows[0].id).toBeNull(); // nothing is persisted yet
    expect(draft.rows[0].fields).toEqual({ Front: "食べる", Back: "to eat" });
    expect(draft.rows[0].tags).toEqual(["N4"]);
  });

  it("gives rows from different note types different type keys", () => {
    const draft = fromParsed(parsed([basic, cloze]));
    const keys = new Set(draft.rows.map((r) => r.noteTypeId));
    expect(keys.size).toBe(2);
  });

  it("keeps cloze notes whole instead of flattening them", () => {
    // Flattening here would destroy cloze on the way in and take the cloze quiz
    // path with it — the reason this doesn't just reuse fromContents.
    const draft = fromParsed(parsed([cloze]));
    expect(draft.rows).toHaveLength(1);
    expect(draft.rows[0].cloze).toBe(true);
    expect(draft.rows[0].fieldNames).toEqual(["Text", "Extra"]);
    expect(draft.rows[0].fields.Text).toBe("今日は{{c1::曇り}}ですね。");
  });

  it("falls back to the first two fields when the note type has no card template", () => {
    const noTemplate = noteType({ frontFields: [], backFields: [], notes: basic.notes });
    const draft = fromParsed(parsed([noTemplate]));
    expect(draft.rows[0].frontFields).toEqual(["Front"]);
    expect(draft.rows[0].backFields).toEqual(["Back"]);
  });

  it("skips note types with no fields at all", () => {
    const empty = noteType({ id: 9, fieldNames: [], notes: [] });
    expect(fromParsed(parsed([empty, basic])).rows).toHaveLength(2);
  });
});

describe("draftToImportRequest", () => {
  it("regroups rows back into their note types", () => {
    const req = draftToImportRequest(fromParsed(parsed([basic, cloze])), { isPublic: true });
    expect(req.noteTypes).toHaveLength(2);
    expect(req.noteTypes[0].notes).toHaveLength(2);
    expect(req.noteTypes[1].notes).toHaveLength(1);
  });

  it("round-trips a cloze note type intact", () => {
    const req = draftToImportRequest(fromParsed(parsed([cloze])), { isPublic: false });
    const type = req.noteTypes[0];
    expect(type.cloze).toBe(true);
    expect(type.fieldNames).toEqual(["Text", "Extra"]);
    expect(type.frontFields).toEqual(["Text"]);
    expect(type.notes[0].fields.Text).toBe("今日は{{c1::曇り}}ですね。");
  });

  it("carries the visibility choice through", () => {
    const draft = fromParsed(parsed([basic]));
    expect(draftToImportRequest(draft, { isPublic: true }).isPublic).toBe(true);
    expect(draftToImportRequest(draft, { isPublic: false }).isPublic).toBe(false);
  });

  it("drops blank rows so an untouched 'Add a card' never persists", () => {
    const draft = fromParsed(parsed([basic]));
    draft.rows.push(addBasicRow());
    expect(draftCardCount(draft)).toBe(2);

    const req = draftToImportRequest(draft, { isPublic: false });
    const total = req.noteTypes.reduce((n, t) => n + t.notes.length, 0);
    expect(total).toBe(2);
  });

  it("routes user-added cards to their own Basic type", () => {
    const draft = fromParsed(parsed([cloze]));
    draft.rows.push(basicRow("new term", "new definition"));

    const req = draftToImportRequest(draft, { isPublic: false });
    const added = req.noteTypes.find((t) => !t.cloze);
    expect(added).toBeDefined();
    expect(added!.fieldNames).toEqual(["Front", "Back"]);
    expect(added!.notes).toHaveLength(1);
    // The cloze type is untouched by the addition.
    expect(req.noteTypes.find((t) => t.cloze)!.notes).toHaveLength(1);
  });

  it("trims the deck name and keeps the source filename", () => {
    const draft = fromParsed(parsed([basic]));
    draft.name = "  Renamed  ";
    const req = draftToImportRequest(draft, { isPublic: false, sourceFilename: "n4.apkg" });
    expect(req.name).toBe("Renamed");
    expect(req.sourceFilename).toBe("n4.apkg");
  });

  it("detects the deck's per-face language from the actual card faces", () => {
    // Bare kanji reads as Chinese by script alone; the front resolves to Japanese
    // because the deck's own faces carry kana. The English back stays null —
    // Latin script abstains from the vote (majorityFaceLang), which means
    // "auto-detect at speak time".
    const req = draftToImportRequest(fromParsed(parsed([basic])), { isPublic: false });
    expect(req.frontLang).toBe("ja");
    expect(req.backLang).toBeNull();
  });

  it("keeps an edited field value", () => {
    const draft = fromParsed(parsed([basic]));
    draft.rows[0] = { ...draft.rows[0], fields: { Front: "食べる", Back: "EDITED" } };
    const req = draftToImportRequest(draft, { isPublic: false });
    expect(req.noteTypes[0].notes[0].fields.Back).toBe("EDITED");
  });
});
