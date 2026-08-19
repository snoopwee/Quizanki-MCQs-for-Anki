import { describe, expect, it } from "vitest";
import { describeAge } from "@/lib/draftStore";

const NOW = Date.UTC(2026, 6, 23, 12, 0, 0);
const minutesAgo = (n: number) => NOW - n * 60_000;

describe("describeAge", () => {
  it("reads as 'just now' under a minute", () => {
    expect(describeAge(minutesAgo(0), NOW)).toBe("just now");
    expect(describeAge(minutesAgo(0.5), NOW)).toBe("just now");
  });

  it("singularises one minute and one hour", () => {
    expect(describeAge(minutesAgo(1), NOW)).toBe("1 minute ago");
    expect(describeAge(minutesAgo(60), NOW)).toBe("1 hour ago");
  });

  it("counts minutes below an hour and hours below a day", () => {
    expect(describeAge(minutesAgo(12), NOW)).toBe("12 minutes ago");
    expect(describeAge(minutesAgo(59), NOW)).toBe("59 minutes ago");
    expect(describeAge(minutesAgo(150), NOW)).toBe("2 hours ago");
  });

  it("falls through to days for an old draft", () => {
    expect(describeAge(minutesAgo(60 * 24), NOW)).toBe("1 day ago");
    expect(describeAge(minutesAgo(60 * 24 * 3), NOW)).toBe("3 days ago");
  });

  it("doesn't produce a negative age from a clock skewed forward", () => {
    expect(describeAge(NOW + 5_000, NOW)).toBe("just now");
  });
});
