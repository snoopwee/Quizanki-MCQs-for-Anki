import { describe, expect, it } from "vitest";
import { isOwnHandle } from "./useUsernameAvailability";

// Regression: the availability endpoint is unauthenticated, so it answers "taken" for the asker's
// OWN handle. Shipped once and renamed a real user's page from hoangtest to hoangtest2.
describe("isOwnHandle", () => {
  it("recognises the handle you already have", () => {
    expect(isOwnHandle("hoangtest", "hoangtest")).toBe(true);
  });

  it("ignores case and surrounding space, matching the server's uniqueness rule", () => {
    expect(isOwnHandle("  HoangTest ", "hoangtest")).toBe(true);
  });

  it("is false for anybody else's handle", () => {
    expect(isOwnHandle("hoangtest2", "hoangtest")).toBe(false);
  });

  it("is false when the viewer has no handle yet — a signup has nothing of its own", () => {
    expect(isOwnHandle("hoangtest", null)).toBe(false);
    expect(isOwnHandle("hoangtest", undefined)).toBe(false);
    expect(isOwnHandle("", "")).toBe(false);
  });
});
