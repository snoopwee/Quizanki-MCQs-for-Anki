import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseLocalDate, streakCaption, streakValue, weekdayLabel } from "@/lib/streakDisplay";

describe("parseLocalDate", () => {
  it("keeps exactly the calendar date the backend sent, at local midnight", () => {
    const d = parseLocalDate("2026-09-14");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(8); // September (0-based)
    expect(d.getDate()).toBe(14);
    expect(d.getHours()).toBe(0);
  });
});

describe("weekdayLabel", () => {
  it("names the weekday of the given calendar date", () => {
    // 2026-09-14 is a Monday.
    expect(weekdayLabel("2026-09-14", "long")).toBe("Monday");
    expect(weekdayLabel("2026-09-14")).toBe("M");
  });

  it("gets a Sunday right — the day a UTC-parsing bug turns into Saturday west of UTC", () => {
    expect(weekdayLabel("2026-09-13", "long")).toBe("Sunday");
  });
});

// The dev machine is east of UTC, where the UTC-parsing bug can't show. Run the same check
// in a zone where it does.
describe("weekdayLabel west of UTC", () => {
  const originalTz = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = "America/Los_Angeles";
  });
  afterAll(() => {
    if (originalTz === undefined) delete process.env.TZ;
    else process.env.TZ = originalTz;
  });

  it("labels the calendar date the backend sent, not the UTC-midnight instant", () => {
    // Proves the zone switch took effect: here a naive parse really is the day before.
    expect(new Date("2026-09-13").getDay()).toBe(6);
    expect(weekdayLabel("2026-09-13", "long")).toBe("Sunday");
    expect(parseLocalDate("2026-09-13").getDate()).toBe(13);
  });
});

describe("streakValue", () => {
  it("pluralises the day count", () => {
    expect(streakValue(0)).toBe("0 days");
    expect(streakValue(1)).toBe("1 day");
    expect(streakValue(12)).toBe("12 days");
  });
});

describe("streakCaption", () => {
  it("says done once today already counts", () => {
    expect(streakCaption({ current: 4, studiedToday: true })).toBe("Done today");
  });

  it("nudges to keep a live streak that hasn't been studied today", () => {
    expect(streakCaption({ current: 4, studiedToday: false })).toBe("Study today");
  });

  it("invites starting one when there's no streak", () => {
    expect(streakCaption({ current: 0, studiedToday: false })).toBe("Start today");
  });

  it("stays short enough to share one mono line with the best streak", () => {
    for (const s of [
      { current: 4, studiedToday: true },
      { current: 4, studiedToday: false },
      { current: 0, studiedToday: false },
    ]) {
      expect(`${streakCaption(s)} · best 365`.length).toBeLessThanOrEqual(22);
    }
  });
});
