import { describe, it, expect } from "vitest";
import {
  extraFields,
  hasExtraFields,
  isFieldShown,
  mergeIdenticalNoteTypes,
  withExtraField,
} from "@/lib/cardFields";

const FIELDS = ["Expression", "Meaning", "Reading", "Example"];
const FRONT = ["Expression"];
const BACK = ["Meaning"];

describe("cardFields", () => {
  it("lists fields that are neither the term nor the primary definition", () => {
    expect(extraFields(FIELDS, FRONT, BACK)).toEqual(["Reading", "Example"]);
  });

  it("treats a field as shown only when it's on the back", () => {
    expect(isFieldShown("Reading", ["Meaning", "Reading"])).toBe(true);
    expect(isFieldShown("Reading", ["Meaning"])).toBe(false);
  });

  it("adds a shown extra to the back in fieldNames order, keeping the term", () => {
    const next = withExtraField("Example", FIELDS, FRONT, BACK, true);
    expect(next.frontFields).toEqual(["Expression"]); // term untouched
    expect(next.backFields).toEqual(["Meaning", "Example"]);
  });

  it("keeps the definition primary first even when multiple extras are on", () => {
    // Start with Example already on, then add Reading — order follows fieldNames.
    const withExample = ["Meaning", "Example"];
    const next = withExtraField("Reading", FIELDS, FRONT, withExample, true);
    expect(next.backFields).toEqual(["Meaning", "Reading", "Example"]);
  });

  it("removes an extra without dropping the primary definition", () => {
    const next = withExtraField("Reading", FIELDS, FRONT, ["Meaning", "Reading"], false);
    expect(next.backFields).toEqual(["Meaning"]);
  });

  describe("mergeIdenticalNoteTypes", () => {
    it("collapses structurally-identical note types into one, keeping all ids", () => {
      const a = { id: "t1", name: "Basic", fieldNames: FIELDS, frontFields: FRONT, backFields: BACK };
      const b = { id: "t2", name: "Basic", fieldNames: FIELDS, frontFields: FRONT, backFields: BACK };
      const merged = mergeIdenticalNoteTypes([a, b]);
      expect(merged).toHaveLength(1);
      expect(merged[0].ids).toEqual(["t1", "t2"]);
      expect(merged[0].fieldNames).toEqual(FIELDS);
    });

    it("keeps note types that differ in fields or layout separate", () => {
      const a = { id: "t1", name: "Basic", fieldNames: FIELDS, frontFields: FRONT, backFields: BACK };
      const c = { id: "t3", name: "Other", fieldNames: ["Front", "Back"], frontFields: ["Front"], backFields: ["Back"] };
      const d = { id: "t4", name: "Basic", fieldNames: FIELDS, frontFields: FRONT, backFields: ["Reading"] };
      const merged = mergeIdenticalNoteTypes([a, c, d]);
      expect(merged.map((m) => m.ids)).toEqual([["t1"], ["t3"], ["t4"]]);
    });
  });

  it("reports whether any note type has a toggleable field", () => {
    expect(
      hasExtraFields([{ fieldNames: FIELDS, frontFields: FRONT, backFields: BACK }]),
    ).toBe(true);
    // A two-field Basic card has no extras.
    expect(
      hasExtraFields([
        { fieldNames: ["Front", "Back"], frontFields: ["Front"], backFields: ["Back"] },
      ]),
    ).toBe(false);
    // Cloze types are excluded.
    expect(
      hasExtraFields([
        { fieldNames: FIELDS, frontFields: FRONT, backFields: BACK, cloze: true },
      ]),
    ).toBe(false);
  });
});
