import { describe, expect, it } from "vitest";
import { BADGE_CAP, inAppHref, relativeTime, unreadBadge, unreadLabel } from "./notificationDisplay";

describe("unreadBadge", () => {
  it("shows nothing when there is nothing unread", () => {
    expect(unreadBadge(0)).toBeNull();
    expect(unreadBadge(-3)).toBeNull();
    expect(unreadBadge(Number.NaN)).toBeNull();
  });

  it("counts up to the cap and then stops widening the dot", () => {
    expect(unreadBadge(1)).toBe("1");
    expect(unreadBadge(BADGE_CAP)).toBe("9");
    expect(unreadBadge(10)).toBe("9+");
    expect(unreadBadge(348)).toBe("9+");
  });
});

describe("unreadLabel", () => {
  it("carries the count, because the badge is decorative", () => {
    expect(unreadLabel(0)).toBe("Notifications");
    expect(unreadLabel(3)).toBe("Notifications, 3 unread");
    // The label is honest even past the badge's cap.
    expect(unreadLabel(42)).toBe("Notifications, 42 unread");
  });
});

describe("relativeTime", () => {
  const now = new Date("2026-09-22T12:00:00Z");

  it("reads in whichever unit is still meaningful", () => {
    expect(relativeTime("2026-09-22T11:59:30Z", now)).toBe("just now");
    expect(relativeTime("2026-09-22T11:55:00Z", now)).toBe("5m");
    expect(relativeTime("2026-09-22T09:00:00Z", now)).toBe("3h");
    expect(relativeTime("2026-09-20T12:00:00Z", now)).toBe("2d");
  });

  it("falls back to a date once a week has passed", () => {
    // Exact wording is the browser's, but it must stop being a relative count.
    expect(relativeTime("2026-09-01T12:00:00Z", now)).not.toMatch(/^\d+[mhd]$|just now/);
  });

  it("treats a row from the near future as just now rather than counting backwards", () => {
    // A browser clock a few seconds behind the server shouldn't produce "-3m".
    expect(relativeTime("2026-09-22T12:00:20Z", now)).toBe("just now");
  });

  it("renders nothing for a missing or unparseable timestamp", () => {
    expect(relativeTime(null, now)).toBe("");
    expect(relativeTime(undefined, now)).toBe("");
    expect(relativeTime("not a date", now)).toBe("");
  });
});

describe("inAppHref", () => {
  it("allows a plain in-app path", () => {
    expect(inAppHref("/decks/abc-123")).toBe("/decks/abc-123");
    expect(inAppHref("  /help  ")).toBe("/help");
  });

  it("has nothing to offer when the row has no link", () => {
    expect(inAppHref(null)).toBeNull();
    expect(inAppHref("")).toBeNull();
    expect(inAppHref("   ")).toBeNull();
  });

  it("refuses to send the reader off-site or into a scheme", () => {
    expect(inAppHref("https://evil.example/phish")).toBeNull();
    // Scheme-relative: "//host" would leave the app while looking like a path.
    expect(inAppHref("//evil.example")).toBeNull();
    expect(inAppHref("javascript:alert(1)")).toBeNull();
    expect(inAppHref("mailto:someone@example.com")).toBeNull();
    // Some browsers normalise backslashes to slashes, so "/\evil.example" can escape too.
    expect(inAppHref("/\\evil.example")).toBeNull();
    expect(inAppHref("/decks\\..\\admin")).toBeNull();
  });
});
