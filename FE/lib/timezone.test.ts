import { afterEach, describe, expect, it, vi } from "vitest";
import { browserTimezone } from "@/lib/timezone";

describe("browserTimezone", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the runtime's IANA timezone", () => {
    expect(browserTimezone()).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
  });

  it("returns undefined instead of throwing when the Intl API is unavailable", () => {
    vi.spyOn(Intl, "DateTimeFormat").mockImplementation(() => {
      throw new Error("Intl unavailable");
    });
    expect(browserTimezone()).toBeUndefined();
  });
});
