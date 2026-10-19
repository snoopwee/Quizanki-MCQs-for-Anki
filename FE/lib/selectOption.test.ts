import { describe, expect, it } from "vitest";
import { initialHighlight, selectedOption } from "./selectOption";

const decks = [
  { value: "a", label: "Cell Biology" },
  { value: "b", label: "Japanese N4" },
  { value: "c", label: "Pharmacology" },
];

describe("selectedOption", () => {
  it("finds the option the value refers to", () => {
    expect(selectedOption(decks, "b")?.label).toBe("Japanese N4");
  });

  it("returns undefined when nothing is chosen, so the trigger can show its placeholder", () => {
    // The regression this file exists for: an unset Select used to render decks[0]'s label as
    // though it were the user's choice, next to a disabled button, with nothing explaining why.
    expect(selectedOption(decks, "")).toBeUndefined();
    expect(selectedOption(decks, undefined)).toBeUndefined();
  });

  it("returns undefined for a value that is no longer in the list", () => {
    // A deck deleted in another tab must not silently become "the first deck".
    expect(selectedOption(decks, "deleted-id")).toBeUndefined();
  });

  it("returns undefined when there are no options at all", () => {
    expect(selectedOption([], "a")).toBeUndefined();
  });

  it("works for non-string values", () => {
    const sizes = [
      { value: 20, label: "20 cards" },
      { value: 40, label: "40 cards" },
    ];
    expect(selectedOption(sizes, 40)?.label).toBe("40 cards");
    expect(selectedOption(sizes, 99)).toBeUndefined();
  });

  it("does not treat a falsy-but-real value as 'nothing chosen'", () => {
    const opts = [
      { value: 0, label: "Off" },
      { value: 1, label: "On" },
    ];
    expect(selectedOption(opts, 0)?.label).toBe("Off");
  });
});

describe("initialHighlight", () => {
  it("opens on the current choice", () => {
    expect(initialHighlight(decks, "c")).toBe(2);
  });

  it("opens at the top when nothing is chosen — a menu must highlight something", () => {
    expect(initialHighlight(decks, "")).toBe(0);
    expect(initialHighlight(decks, "deleted-id")).toBe(0);
  });

  it("never returns a negative index", () => {
    expect(initialHighlight([], "a")).toBe(0);
  });
});
