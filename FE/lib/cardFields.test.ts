import { describe, it, expect } from "vitest";
import {
  extraFields,
  hasExtraFields,
  isFieldShown,
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
