import { describe, expect, it } from "vitest";
import { profileUrl } from "./profileUrl";

describe("profileUrl", () => {
  it("prefers the readable handle", () => {
    expect(profileUrl("8f3c0e21-4b7a-4d61-9f0e-2a1b3c4d5e6f", "pyrettt")).toBe("/user/pyrettt");
  });

  it("falls back to the id alias when there is no handle yet", () => {
    // Never a dead link: /authors/{id} redirects to whatever they're called today.
    expect(profileUrl("user-1", null)).toBe("/authors/user-1");
    expect(profileUrl("user-1", undefined)).toBe("/authors/user-1");
    expect(profileUrl("user-1", "")).toBe("/authors/user-1");
  });

  it("escapes a handle so it can't break out of the path", () => {
    expect(profileUrl("user-1", "a/b")).toBe("/user/a%2Fb");
  });
});
