import { describe, it, expect } from "vitest";
import type { User } from "@supabase/supabase-js";
import { avatarUrlOf, hasCustomAvatar, initialsFrom } from "./userDisplay";

// Minimal User stub — only the metadata the helpers read.
function userWith(meta: Record<string, unknown>): User {
  return { user_metadata: meta } as unknown as User;
}

describe("initialsFrom", () => {
  it("takes the first letter of the first two words", () => {
    expect(initialsFrom("Ada Lovelace", "a@x.com")).toBe("AL");
    expect(initialsFrom("mary jane watson", "m@x.com")).toBe("MJ");
  });

  it("takes the first two characters of a single-word name", () => {
    expect(initialsFrom("Ada", "a@x.com")).toBe("AD");
  });

  it("collapses extra whitespace", () => {
    expect(initialsFrom("  Ada   Lovelace  ", "a@x.com")).toBe("AL");
  });

  it("falls back to the email when the name is empty", () => {
    expect(initialsFrom("", "thomas@example.com")).toBe("TH");
    expect(initialsFrom("   ", "z@example.com")).toBe("Z@");
  });

  it("returns a placeholder when there's nothing to work with", () => {
    expect(initialsFrom("", "")).toBe("?");
  });
});

describe("avatarUrlOf", () => {
  it("prefers the user's uploaded photo above everything", () => {
    expect(
      avatarUrlOf(
        userWith({
          custom_avatar_url: "https://x/u.jpg",
          avatar_url: "https://g/oauth.png",
          picture: "https://g/p.png",
        }),
      ),
    ).toBe("https://x/u.jpg");
  });

  it("defaults to the OAuth photo when there's no upload (Google avatar_url)", () => {
    expect(avatarUrlOf(userWith({ avatar_url: "https://g/oauth.png" }))).toBe("https://g/oauth.png");
  });

  it("falls back to the raw `picture` claim when avatar_url is absent", () => {
    expect(avatarUrlOf(userWith({ picture: "https://g/p.png" }))).toBe("https://g/p.png");
  });

  it("ignores a null/blank custom avatar and falls back to the OAuth default", () => {
    expect(avatarUrlOf(userWith({ custom_avatar_url: null, avatar_url: "https://g/oauth.png" }))).toBe(
      "https://g/oauth.png",
    );
  });

  it("returns \"\" (→ initials) when there's no image and for a null user", () => {
    expect(avatarUrlOf(userWith({}))).toBe("");
    expect(avatarUrlOf(null)).toBe("");
  });
});

describe("hasCustomAvatar", () => {
  it("is true only when the user uploaded their own photo", () => {
    expect(hasCustomAvatar(userWith({ custom_avatar_url: "https://x/u.jpg" }))).toBe(true);
  });

  it("is false for an OAuth-only default (so Remove stays hidden)", () => {
    expect(hasCustomAvatar(userWith({ avatar_url: "https://g/oauth.png", picture: "https://g/p.png" }))).toBe(
      false,
    );
  });

  it("is false when there's nothing and for a null user", () => {
    expect(hasCustomAvatar(userWith({}))).toBe(false);
    expect(hasCustomAvatar(null)).toBe(false);
  });
});
