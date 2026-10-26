import { describe, expect, it } from "vitest";
import {
  CONFIRM_EMAIL_MESSAGE,
  DEFAULT_NEXT,
  EMAIL_OTP_TYPES,
  oauthRedirectTo,
  readEmailOtpType,
  safeNextPath,
} from "./authCallback";

describe("readEmailOtpType", () => {
  it("accepts every type Supabase actually puts on an email link", () => {
    for (const t of EMAIL_OTP_TYPES) {
      expect(readEmailOtpType(t)).toBe(t);
    }
  });

  it("accepts the two that matter here by name", () => {
    // "recovery" is the password-reset link; "signup" is the email-confirmation link.
    expect(readEmailOtpType("recovery")).toBe("recovery");
    expect(readEmailOtpType("signup")).toBe("signup");
  });

  it("rejects anything not on the list instead of passing it through", () => {
    // `type` comes off the query string. Casting it straight to EmailOtpType would turn a typo in
    // an email template into an unexplained client failure rather than a clean "link not usable".
    expect(readEmailOtpType("recovery ")).toBeNull();
    expect(readEmailOtpType("RECOVERY")).toBeNull();
    expect(readEmailOtpType("sign_up")).toBeNull();
    expect(readEmailOtpType("phone_change")).toBeNull();
  });

  it("treats absent, empty and nullish as no type at all", () => {
    expect(readEmailOtpType(null)).toBeNull();
    expect(readEmailOtpType(undefined)).toBeNull();
    expect(readEmailOtpType("")).toBeNull();
  });
});

describe("safeNextPath", () => {
  it("keeps an ordinary in-app destination", () => {
    expect(safeNextPath("/auth/reset")).toBe("/auth/reset");
    expect(safeNextPath("/decks/abc/practice")).toBe("/decks/abc/practice");
    expect(safeNextPath("/home?tab=saved")).toBe("/home?tab=saved");
  });

  it("falls back to the default when there is nothing usable", () => {
    expect(safeNextPath(null)).toBe(DEFAULT_NEXT);
    expect(safeNextPath(undefined)).toBe(DEFAULT_NEXT);
    expect(safeNextPath("")).toBe(DEFAULT_NEXT);
  });

  it("closes the open redirect: an unrooted next reaches ANOTHER HOST", () => {
    // These are the shapes that mattered, confirmed against Node's URL parser with
    // origin = "https://quizanki.com":
    //   "@evil.example"  -> host evil.example            (everything before @ becomes userinfo)
    //   ".evil.example"  -> host quizanki.com.evil.example  (a lookalike they can register)
    expect(safeNextPath("@evil.example")).toBe(DEFAULT_NEXT);
    expect(safeNextPath(".evil.example")).toBe(DEFAULT_NEXT);
    expect(safeNextPath(".evil.example/pwned")).toBe(DEFAULT_NEXT);
    expect(safeNextPath("evil.example")).toBe(DEFAULT_NEXT);
  });

  it("refuses the protocol-relative spellings too", () => {
    // Counter-intuitively these were already harmless — prepending the origin turns "//host"
    // into a PATH on our own host. Rejected anyway so no future change to how the redirect is
    // assembled can make them meaningful again.
    expect(safeNextPath("//evil.example")).toBe(DEFAULT_NEXT);
    expect(safeNextPath("/\\evil.example")).toBe(DEFAULT_NEXT);
  });

  it("refuses an absolute URL and a scheme, one of which threw outright", () => {
    expect(safeNextPath("https://evil.example/x")).toBe(DEFAULT_NEXT);
    expect(safeNextPath("http://evil.example")).toBe(DEFAULT_NEXT);
    // `${origin}javascript:alert(1)` is not a parseable URL at all — a 500, not a redirect.
    expect(safeNextPath("javascript:alert(1)")).toBe(DEFAULT_NEXT);
  });

  it("refuses a relative path, so it cannot land relative to the callback", () => {
    expect(safeNextPath("home")).toBe(DEFAULT_NEXT);
    expect(safeNextPath("../admin")).toBe(DEFAULT_NEXT);
  });

  it("defaults somewhere a signed-in person belongs", () => {
    expect(DEFAULT_NEXT.startsWith("/")).toBe(true);
    expect(DEFAULT_NEXT).not.toMatch(/^\/\//);
  });
});

describe("CONFIRM_EMAIL_MESSAGE", () => {
  it("reads as success, because the account WAS created", () => {
    // It used to go through the modal's error state, telling someone their sign-up had worked
    // using the same red box as "that password is wrong".
    expect(CONFIRM_EMAIL_MESSAGE).toMatch(/created/i);
    expect(CONFIRM_EMAIL_MESSAGE).not.toMatch(/error|failed|sorry|problem|couldn't/i);
  });

  it("says what to do next, and mentions spam like the reset message does", () => {
    expect(CONFIRM_EMAIL_MESSAGE).toMatch(/spam/i);
    expect(CONFIRM_EMAIL_MESSAGE).toMatch(/log in/i);
  });
});

describe("oauthRedirectTo", () => {
  it("comes back through the callback, carrying where to go next", () => {
    expect(oauthRedirectTo("https://quizanki.com", "/home")).toBe(
      "https://quizanki.com/auth/callback?next=%2Fhome",
    );
  });

  it("encodes a destination that has its own query, so it survives intact", () => {
    // The guest save flow sends people to the review editor with its handoff flag.
    expect(oauthRedirectTo("https://quizanki.com", "/import?draft=1")).toBe(
      "https://quizanki.com/auth/callback?next=%2Fimport%3Fdraft%3D1",
    );
  });

  it("sanitises the destination rather than trusting it", () => {
    // Same guard the callback applies server-side; doing it here too means a bad value never
    // even leaves the browser.
    expect(oauthRedirectTo("https://quizanki.com", "@evil.example")).toContain("next=%2Fhome");
    expect(oauthRedirectTo("https://quizanki.com", "//evil.example")).toContain("next=%2Fhome");
  });

  it("works on localhost and previews, being built from the live origin", () => {
    expect(oauthRedirectTo("http://localhost:3000", "/home")).toBe(
      "http://localhost:3000/auth/callback?next=%2Fhome",
    );
  });

  it("does not double the slash when the origin has a trailing one", () => {
    expect(oauthRedirectTo("https://quizanki.com/", "/home")).toBe(
      "https://quizanki.com/auth/callback?next=%2Fhome",
    );
  });
});
