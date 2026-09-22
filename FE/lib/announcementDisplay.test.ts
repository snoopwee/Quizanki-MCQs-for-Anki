import { describe, expect, it } from "vitest";
import {
  announcementProblem,
  confirmQuestion,
  MAX_ANNOUNCEMENT_BODY,
  MAX_ANNOUNCEMENT_TITLE,
  sentSummary,
} from "./announcementDisplay";

const draft = (title: string, body = "", link = "") => ({ title, body, link });

describe("announcementProblem", () => {
  it("passes a reasonable draft", () => {
    expect(announcementProblem(draft("Maintenance tonight", "Ten minutes from 22:00.", "/help"))).toBeNull();
    // No body and no link is a perfectly good announcement.
    expect(announcementProblem(draft("We shipped folders"))).toBeNull();
  });

  it("insists on a title, whitespace not counting", () => {
    expect(announcementProblem(draft(""))).toMatch(/title/i);
    expect(announcementProblem(draft("   "))).toMatch(/title/i);
  });

  it("says how far over the limits a draft is, so the fix is obvious", () => {
    expect(announcementProblem(draft("t".repeat(MAX_ANNOUNCEMENT_TITLE + 5)))).toContain("5 characters too long");
    expect(announcementProblem(draft("Fine", "b".repeat(MAX_ANNOUNCEMENT_BODY + 2)))).toContain(
      "2 characters too long",
    );
  });

  it("accepts the limits exactly", () => {
    expect(announcementProblem(draft("t".repeat(MAX_ANNOUNCEMENT_TITLE)))).toBeNull();
    expect(announcementProblem(draft("Fine", "b".repeat(MAX_ANNOUNCEMENT_BODY)))).toBeNull();
  });

  it("refuses a link that would send everyone off-site", () => {
    expect(announcementProblem(draft("Fine", "", "https://evil.example"))).toMatch(/in-app path/);
    expect(announcementProblem(draft("Fine", "", "//evil.example"))).toMatch(/in-app path/);
    expect(announcementProblem(draft("Fine", "", "help"))).toMatch(/in-app path/);
    // Blank stays fine — it just means no link.
    expect(announcementProblem(draft("Fine", "", "   "))).toBeNull();
  });
});

describe("confirmQuestion", () => {
  it("names the real number of people before an irreversible fan-out", () => {
    expect(confirmQuestion("all", 12)).toBe("Send this to all 12 people?");
    expect(confirmQuestion("all", 1)).toBe("Send this to 1 person?");
  });

  it("stays honest when the audience size hasn't loaded", () => {
    expect(confirmQuestion("all", undefined)).toBe("Send this to everyone?");
  });

  it("is explicit that a test send goes nowhere else", () => {
    expect(confirmQuestion("me", 12)).toBe("Send this to yourself only?");
  });
});

describe("sentSummary", () => {
  it("points a test send at the bell, which is the thing being checked", () => {
    expect(sentSummary("me", 1, 1)).toMatch(/bell/i);
  });

  it("reports the backend's own count", () => {
    expect(sentSummary("all", 12, 12)).toBe("Sent to 12 people.");
    expect(sentSummary("all", 1, 1)).toBe("Sent to 1 person.");
  });

  it("owns up to skipped recipients instead of quietly reporting the smaller number", () => {
    expect(sentSummary("all", 12, 10)).toBe("Sent to 10 people. 2 recipients were skipped.");
    expect(sentSummary("all", 2, 1)).toBe("Sent to 1 person. 1 recipient was skipped.");
  });

  it("says plainly when nothing went out", () => {
    expect(sentSummary("all", 0, 0)).toMatch(/nothing was sent/i);
    expect(sentSummary("me", 1, 0)).toMatch(/nothing was sent/i);
  });
});
