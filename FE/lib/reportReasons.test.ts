import { describe, expect, it } from "vitest";
import {
  DECK_REPORT_REASONS,
  DISMISS_TEMPLATES,
  NOTE_REPORT_REASONS,
  RESOLVE_TEMPLATES,
  TAKEDOWN_TEMPLATES,
  reasonsFor,
} from "./reportReasons";

describe("reasonsFor", () => {
  it("gives each queue its own vocabulary", () => {
    // A deck is public work, reported for what it IS; a note is aimed at one person, reported for
    // how it BEHAVES. Sharing one list would offer "Copyright" on a rating note.
    expect(reasonsFor("decks")).toBe(DECK_REPORT_REASONS);
    expect(reasonsFor("notes")).toBe(NOTE_REPORT_REASONS);
    expect(reasonsFor("decks")).not.toContain("Harassment");
    expect(reasonsFor("notes")).not.toContain("Copyright");
  });

  it("keeps Other last, so the filter's escape hatch doesn't move", () => {
    expect(DECK_REPORT_REASONS.at(-1)).toBe("Other");
    expect(NOTE_REPORT_REASONS.at(-1)).toBe("Other");
  });
});

describe("action templates", () => {
  it("offers a quick reason for every action", () => {
    // Empty would mean the mandatory reason box has no shortcut and every decision is typed.
    for (const set of [RESOLVE_TEMPLATES, DISMISS_TEMPLATES, TAKEDOWN_TEMPLATES]) {
      expect(set.length).toBeGreaterThan(0);
      expect(set.every((t) => t.trim().length > 0)).toBe(true);
    }
  });

  it("writes takedown reasons for the person who receives them", () => {
    // These go into the removed rating's author's notification, so they explain rather than label.
    expect(TAKEDOWN_TEMPLATES.every((t) => t.trim().endsWith("."))).toBe(true);
  });
});
