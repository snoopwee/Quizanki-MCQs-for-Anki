import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseLocalDate, streakCaptionKey, weekdayLabel } from "@/lib/streakDisplay";
import { en } from "@/lib/i18n/messages/en";
import { vi } from "@/lib/i18n/messages/vi";

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

describe("streakCaptionKey", () => {
  const STATES = [
    { streak: { current: 4, studiedToday: true }, key: "streak.doneToday" },
    { streak: { current: 4, studiedToday: false }, key: "streak.studyToday" },
    { streak: { current: 0, studiedToday: false }, key: "streak.startToday" },
  ] as const;

  it("names the key for each state: done, nudge, or invitation", () => {
    for (const { streak, key } of STATES) {
      expect(streakCaptionKey(streak)).toBe(key);
    }
  });

  it("keeps every caption short enough to share one mono line, in BOTH languages", () => {
    // The tile is a third of the row and the caption sits on one line with "· best N" — it must
    // not wrap. The budget comes from MEASURING the rendered line, not from taste: at the tile's
    // 12px Geist Mono the widest case ("Bắt đầu hôm nay · kỷ lục 365", 28 chars) is 202px against
    // 282px available — still inside it at the 125% Text-size setting. The old rule was 22 chars,
    // which only ever measured English and was stale for this layout.
    const BUDGET = 28;
    for (const { key } of STATES) {
      expect(`${en[key]} · ${en["home.streakBest"]}`.replace("{count}", "365").length)
        .toBeLessThanOrEqual(BUDGET);
      expect(`${vi[key]} · ${vi["home.streakBest"]}`.replace("{count}", "365").length)
        .toBeLessThanOrEqual(BUDGET);
    }
  });
});
