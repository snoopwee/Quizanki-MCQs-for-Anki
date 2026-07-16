import { describe, it, expect } from "vitest";
import { initialsFrom } from "./userDisplay";

describe("initialsFrom", () => {
  it("takes the first letter of the first two words", () => {
    expect(initialsFrom("Ada Lovelace", "a@x.com")).toBe("AL");
    expect(initialsFrom("mary jane watson", "m@x.com")).toBe("MJ");
  });

  it("takes the first two characters of a single-word name", () => {
    expect(initialsFrom("Ada", "a@x.com")).toBe("AD");
  });

  it("collapses extra whitespace", () => {
    expect(initialsFrom("  Ada   Lovelace  ", "a@x.com")).toBe("AL");
  });

  it("falls back to the email when the name is empty", () => {
    expect(initialsFrom("", "thomas@example.com")).toBe("TH");
    expect(initialsFrom("   ", "z@example.com")).toBe("Z@");
  });

  it("returns a placeholder when there's nothing to work with", () => {
    expect(initialsFrom("", "")).toBe("?");
  });
});
