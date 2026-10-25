import { describe, expect, it } from "vitest";
import {
  MIN_PASSWORD,
  passwordResetRedirect,
  looksAlreadySent,
  readRecoveryLink,
  RECOVERY_PROBLEMS,
  RESET_SENT_MESSAGE,
  validateNewPassword,
} from "./passwordReset";

describe("validateNewPassword", () => {
  it("accepts a long enough matching pair", () => {
    expect(validateNewPassword("longenough1", "longenough1")).toBeNull();
  });

  it("rejects one that is too short", () => {
    expect(validateNewPassword("short", "short")).toMatch(/at least 8/);
  });

  it("rejects a mismatch", () => {
    expect(validateNewPassword("longenough1", "longenough2")).toMatch(/don't match/);
  });

  it("complains about LENGTH first when both are wrong", () => {
    // Telling someone their two four-character passwords differ sends them to fix the wrong thing.
    expect(validateNewPassword("abc", "xyz")).toMatch(/at least 8/);
  });

  it("rejects an empty password rather than treating it as 'unchanged'", () => {
    expect(validateNewPassword("", "")).toMatch(/at least 8/);
  });

  it("counts characters, not words — spaces are a legitimate password", () => {
    expect(validateNewPassword("a b c d ", "a b c d ")).toBeNull();
  });

  it("is exact at the boundary", () => {
    const atLimit = "x".repeat(MIN_PASSWORD);
    expect(validateNewPassword(atLimit, atLimit)).toBeNull();
    const underLimit = "x".repeat(MIN_PASSWORD - 1);
    expect(validateNewPassword(underLimit, underLimit)).not.toBeNull();
  });
});

describe("passwordResetRedirect", () => {
  it("points at the client page, NOT the server callback route", () => {
    // /auth/callback is a route handler, and a URL fragment is never sent to the server. Supabase
    // returns some recovery links as "#access_token=...", which that handler cannot see at all —
    // it reads an empty query, calls the link broken, and dumps the user on the landing page.
    expect(passwordResetRedirect("https://quizanki.com")).toBe("https://quizanki.com/auth/reset");
    expect(passwordResetRedirect("https://quizanki.com")).not.toContain("/auth/callback");
  });

  it("works on localhost and previews, because it is built from the live origin", () => {
    expect(passwordResetRedirect("http://localhost:3000")).toBe("http://localhost:3000/auth/reset");
    expect(passwordResetRedirect("https://deploy-abc.vercel.app")).toBe(
      "https://deploy-abc.vercel.app/auth/reset",
    );
  });

  it("does not produce a double slash when the origin has a trailing one", () => {
    expect(passwordResetRedirect("https://quizanki.com/")).toBe("https://quizanki.com/auth/reset");
    expect(passwordResetRedirect("https://quizanki.com///")).not.toContain("com//auth");
  });

  it("adds no query of its own, so the link's own params arrive unshadowed", () => {
    // Supabase appends ?code= or #access_token= to whatever this returns.
    expect(passwordResetRedirect("https://quizanki.com")).not.toContain("?");
  });
});

describe("readRecoveryLink", () => {
  it("reads a PKCE code out of the query string", () => {
    expect(readRecoveryLink("?code=abc123", "")).toEqual({ kind: "code", code: "abc123" });
  });

  it("reads implicit tokens out of the FRAGMENT — the shape the server route could never see", () => {
    expect(readRecoveryLink("", "#access_token=at&refresh_token=rt&type=recovery")).toEqual({
      kind: "tokens",
      accessToken: "at",
      refreshToken: "rt",
    });
  });

  it("tolerates the leading ? and # being absent", () => {
    expect(readRecoveryLink("code=abc", "")).toEqual({ kind: "code", code: "abc" });
    expect(readRecoveryLink("", "access_token=at&refresh_token=rt")).toEqual({
      kind: "tokens",
      accessToken: "at",
      refreshToken: "rt",
    });
  });

  it("calls an expired link expired instead of trying to spend it", () => {
    // Spending the stale token anyway turns a clear "this expired" into a vague failure.
    expect(
      readRecoveryLink(
        "",
        "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired",
      ),
    ).toEqual({ kind: "error", reason: "expired" });
  });

  it("prefers an explicit error over credentials that are also present", () => {
    expect(readRecoveryLink("?code=abc", "#error_code=otp_expired")).toEqual({
      kind: "error",
      reason: "expired",
    });
  });

  it("treats a non-expiry error as a dead link rather than guessing", () => {
    expect(readRecoveryLink("", "#error=access_denied")).toEqual({ kind: "error", reason: "missing" });
  });

  it("reports nothing when the page was opened directly", () => {
    expect(readRecoveryLink("", "")).toEqual({ kind: "none" });
  });

  it("will not try to use an access token with no refresh token", () => {
    // setSession needs both; a lone access token cannot be refreshed, so it is not a session.
    expect(readRecoveryLink("", "#access_token=at&type=recovery")).toEqual({ kind: "none" });
  });
});

describe("RECOVERY_PROBLEMS", () => {
  it("tells a cross-device user the actual fix instead of 'try again'", () => {
    // Requesting on a laptop and opening the mail on a phone leaves the PKCE verifier behind.
    // "Request another link" would loop them forever, so the copy must name the real cause.
    expect(RECOVERY_PROBLEMS["wrong-browser"].title).toMatch(/same browser|browser you asked/i);
    expect(RECOVERY_PROBLEMS["wrong-browser"].body).toMatch(/same browser/i);
  });

  it("tells the other two to ask for a fresh link, because that does fix those", () => {
    expect(RECOVERY_PROBLEMS.expired.body).toMatch(/fresh one|new link/i);
    expect(RECOVERY_PROBLEMS.missing.body).toMatch(/fresh one|new link/i);
  });

  it("never blames the user for an expired link", () => {
    expect(RECOVERY_PROBLEMS.expired.title).not.toMatch(/you (did|should|forgot)/i);
  });
});

describe("RESET_SENT_MESSAGE", () => {
  it("never reveals whether the address has an account", () => {
    // User enumeration: a specific "no such account" lets anyone test addresses against the site.
    expect(RESET_SENT_MESSAGE).toMatch(/if that address has an account/i);
    expect(RESET_SENT_MESSAGE).not.toMatch(/\bno account\b|not found|doesn't exist|unregistered/i);
  });

  it("points at the spam folder, which is where these actually go", () => {
    expect(RESET_SENT_MESSAGE).toMatch(/spam/i);
  });
});

describe("looksAlreadySent", () => {
  it("treats Supabase's 429 as sent, because a visible cooldown identifies real accounts", () => {
    // An unregistered address returns 200 at once; only a registered one can be rate-limited.
    expect(looksAlreadySent({ status: 429 })).toBe(true);
  });

  it("recognises the cooldown by message too, in case the status is not carried through", () => {
    expect(
      looksAlreadySent({ message: "For security purposes, you can only request this after 54 seconds." }),
    ).toBe(true);
    expect(looksAlreadySent({ message: "email rate limit exceeded" })).toBe(true);
  });

  it("still lets a genuine transport failure through", () => {
    // The original symptom: Resend rejected the recipient and Supabase answered 500. Swallowing
    // that would have shown "a link is on its way" when nothing had been sent.
    expect(looksAlreadySent({ status: 500, message: "Error sending recovery email" })).toBe(false);
    expect(looksAlreadySent({ status: 0, message: "Failed to fetch" })).toBe(false);
  });

  it("is false for no error at all", () => {
    expect(looksAlreadySent(null)).toBe(false);
  });
});
