import { describe, expect, it } from "vitest";
import { timeAgo } from "./relativeTime";

// A fixed "now" so the assertions are deterministic.
const NOW = Date.parse("2026-07-28T12:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const YEAR = 365 * DAY;

describe("timeAgo", () => {
  it("collapses very recent stamps to 'just now'", () => {
    expect(timeAgo(ago(5 * SECOND), NOW)).toBe("just now");
    expect(timeAgo(ago(44 * SECOND), NOW)).toBe("just now");
  });

  it("uses the '1 unit ago' wording (numeric: always), not 'yesterday'", () => {
    expect(timeAgo(ago(1 * HOUR), NOW)).toBe("1 hour ago");
    expect(timeAgo(ago(1 * DAY), NOW)).toBe("1 day ago");
  });

  it("scales up through the units", () => {
    expect(timeAgo(ago(3 * DAY), NOW)).toBe("3 days ago");
    expect(timeAgo(ago(2 * HOUR), NOW)).toBe("2 hours ago");
    expect(timeAgo(ago(4 * YEAR), NOW)).toBe("4 years ago");
  });

  it("returns null for a missing or unparseable stamp", () => {
    expect(timeAgo(null, NOW)).toBeNull();
    expect(timeAgo(undefined, NOW)).toBeNull();
    expect(timeAgo("not-a-date", NOW)).toBeNull();
  });
});
