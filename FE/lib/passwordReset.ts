import { en } from "@/lib/i18n/messages/en";

// Password rules and the reset flow's logic, kept pure so both places that set a password —
// Settings, and the reset page — agree without either owning the rules.

/** Supabase's own default minimum. Raising it here without raising it there just means the
 *  server accepts passwords this form rejects, which is confusing rather than safer. */
export const MIN_PASSWORD = 8;

/**
 * Why a new password is unacceptable, or `null` when it is fine.
 *
 * <p>Order matters: "too short" before "they don't match", because telling someone their two
 * four-character passwords differ sends them to fix the wrong thing.
 */
export function validateNewPassword(password: string, confirm: string): string | null {
  if (password.length < MIN_PASSWORD) {
    return `Password must be at least ${MIN_PASSWORD} characters.`;
  }
  if (password !== confirm) {
    return "The two passwords don't match.";
  }
  return null;
}

/**
 * Where Supabase sends someone after they click the link in a reset email.
 *
 * <p>Points straight at {@code /auth/reset} rather than through {@code /auth/callback}, and that
 * choice is the whole subtlety of this flow. A recovery link comes back in one of two shapes, and
 * a server route handler can only see one of them:
 *
 * <ul>
 *   <li>{@code ?code=...} — PKCE. In the query string, so the server can read and exchange it.</li>
 *   <li>{@code #access_token=...&refresh_token=...} — implicit. <b>A fragment is never sent to the
 *       server.</b> {@code /auth/callback} therefore sees an empty query, concludes the link is
 *       broken and redirects to the landing page.</li>
 * </ul>
 *
 * <p>Verified against a real recovery link on 2026-10-25: the tokens arrived in the fragment, the
 * callback bounced to {@code /?error=callback_failed}, and the learner was left on the marketing
 * page with a perfectly valid token stranded in the address bar and nothing to explain it.
 * Supabase emits that shape whenever the request behind the link carried no PKCE challenge.
 *
 * <p>So the destination is a CLIENT page, which can see the query AND the fragment, and one place
 * owns "turn whatever this link gave me into a session, or say why not" — see
 * {@link readRecoveryLink}.
 *
 * <p>Built from the live {@code origin} rather than a constant, so it is correct on the custom
 * domain, on a Vercel preview and on localhost without a build-time flag. The origin must be in
 * Supabase's redirect allow-list or the link silently falls back to the project's Site URL.
 *
 * <p><b>This only governs the two link shapes Supabase produces on its own.</b> The third and best
 * shape — {@code ?token_hash=}, the only one that works on a different device — has to be asked
 * for in the <i>email template</i> (Supabase → Authentication → Emails → Reset Password):
 *
 * <pre>{@code <a href="{{ .SiteURL }}/auth/reset?token_hash={{ .TokenHash }}&type=recovery">}</pre>
 *
 * <p>Until that template says so, recovery emails carry {@code ?code=} and a reset requested on
 * one device cannot be completed on another. The page handles all three either way.
 */
export function passwordResetRedirect(origin: string): string {
  const base = origin.replace(/\/+$/, "");
  return `${base}/auth/reset`;
}

/**
 * What we say after a reset is requested — <b>the same sentence whether or not that address has
 * an account.</b>
 *
 * <p>"No account with that email" is a free user-enumeration oracle: anyone could sit on this form
 * and learn which addresses are registered. Supabase's own API is deliberately quiet about it too,
 * returning success either way, so a specific message here would be us leaking what the API
 * refused to.
 */
export const RESET_SENT_MESSAGE = en["auth.resetSent"];

/** Why a recovery link could not be turned into a session. */
export type RecoveryProblem = "expired" | "wrong-browser" | "missing";

/**
 * What a recovery link turned out to be carrying. `none` covers both "opened this URL directly"
 * and a malformed link — neither can produce a session, and neither is worth separate copy.
 */
export type RecoveryLink =
  | { kind: "hash"; tokenHash: string }
  | { kind: "code"; code: string }
  | { kind: "tokens"; accessToken: string; refreshToken: string }
  | { kind: "error"; reason: RecoveryProblem }
  | { kind: "none" };

/**
 * Reads a recovery link's payload out of the URL, looking in <b>both</b> the query string and the
 * fragment because Supabase uses one or the other depending on how the link was created.
 *
 * <p>An explicit error wins over any credentials also present: Supabase appends
 * {@code error_code=otp_expired} to an expired link, and trying to spend the stale token anyway
 * would turn a clear "this expired" into a vague failure.
 */
export function readRecoveryLink(search: string, hash: string): RecoveryLink {
  const query = new URLSearchParams(search.replace(/^\?/, ""));
  const fragment = new URLSearchParams(hash.replace(/^#/, ""));
  const pick = (key: string) => fragment.get(key) || query.get(key) || null;

  const errorCode = pick("error_code") ?? pick("error");
  if (errorCode) {
    // "otp_expired", and "access_denied" for a link that was already spent.
    return { kind: "error", reason: /expired/i.test(errorCode) ? "expired" : "missing" };
  }

  // Checked FIRST, because it is the only shape that survives being opened somewhere else.
  // `token_hash` is verified server-side against the account, with no PKCE verifier and no prior
  // browser state — proven 2026-10-26 with a bare POST carrying only the publishable key, which
  // returned a full session. A `?code=` cannot do that; see RECOVERY_PROBLEMS["wrong-browser"].
  const tokenHash = pick("token_hash");
  if (tokenHash) return { kind: "hash", tokenHash };

  const code = pick("code");
  if (code) return { kind: "code", code };

  const accessToken = pick("access_token");
  const refreshToken = pick("refresh_token");
  // setSession needs both. An access token on its own cannot be refreshed, so it is not usable.
  if (accessToken && refreshToken) return { kind: "tokens", accessToken, refreshToken };

  return { kind: "none" };
}

/**
 * What to tell someone whose link did not work. Separated by cause because the three have
 * genuinely different fixes, and "try again" is useless advice for two of them.
 */
export const RECOVERY_PROBLEMS: Record<RecoveryProblem, { title: string; body: string }> = {
  expired: {
    title: "This reset link has expired.",
    body: "Reset links are single-use and only last a short while. Ask for a fresh one and it will work.",
  },
  "wrong-browser": {
    // PKCE keeps half the handshake in the browser that ASKED for the reset, so a link requested
    // on a laptop and opened on a phone cannot complete. Saying "try again" would loop them.
    title: "Open this link in the browser you asked from.",
    body: "For your security, the link only completes in the same browser that requested the reset. Open it there, or ask for a new link from this device.",
  },
  missing: {
    title: "This reset link doesn't work any more.",
    body: "It may have already been used, or been opened without the link from your email. Ask for a fresh one and it will work.",
  },
};

/**
 * Whether a {@code resetPasswordForEmail} failure should be reported to the learner as success.
 *
 * <p>Supabase rate-limits recovery requests per account, so asking twice inside its cooldown
 * answers <b>429</b>. Surfacing that would undo the whole point of {@link RESET_SENT_MESSAGE}: an
 * address with no account returns 200 instantly, so a visible "wait 60 seconds" is a precise
 * signal that the address IS registered — the user-enumeration oracle, reintroduced by an error
 * handler. Verified against the live project on 2026-10-25, which answered 429 on a second
 * request for the same address.
 *
 * <p>Reporting it as sent is also honest rather than merely safe: a 429 means an email went out
 * moments ago, so "a reset link is on its way" is literally true.
 */
export function looksAlreadySent(error: { status?: number; message?: string } | null): boolean {
  if (!error) return false;
  if (error.status === 429) return true;
  return /rate limit|only request this after|too many requests/i.test(error.message ?? "");
}
