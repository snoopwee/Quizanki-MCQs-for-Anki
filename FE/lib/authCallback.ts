// The email-link side of auth: what `/auth/callback` is allowed to act on, and where it is
// allowed to send people afterwards. Pure, because the route handler itself cannot be unit-tested
// without a request, and these are the two decisions in it that can actually be wrong.

/**
 * The `type` values Supabase puts on an email link, and the only ones we will hand to
 * `verifyOtp`. A closed list rather than a cast: `type` arrives from the URL, so casting
 * `searchParams.get("type")` straight into `EmailOtpType` would let any string through to the
 * client and turn a typo in an email template into an unexplained failure.
 */
export const EMAIL_OTP_TYPES = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
] as const;

export type EmailOtpTypeName = (typeof EMAIL_OTP_TYPES)[number];

/** The link's `type`, or `null` when it is absent or not one we recognise. */
export function readEmailOtpType(raw: string | null | undefined): EmailOtpTypeName | null {
  if (!raw) return null;
  const found = EMAIL_OTP_TYPES.find((t) => t === raw);
  return found ?? null;
}

/** Where the callback sends anyone who arrives without a usable `next`. */
export const DEFAULT_NEXT = "/home";

/**
 * A same-site path to redirect to after a successful callback.
 *
 * <p>`next` comes off the query string and is interpolated as `` `${origin}${next}` ``, and
 * <b>that was an open redirect.</b> Measured with Node's own URL parser rather than assumed:
 *
 * <pre>
 *   next = "/home"            -> host quizanki.com                  (fine)
 *   next = "//evil.example"   -> host quizanki.com, path //…        (fine — the origin saves it)
 *   next = ".evil.example"    -> host quizanki.com.evil.example     (a lookalike they can register)
 *   next = "@evil.example"    -> host evil.example                  (another site entirely)
 *   next = "javascript:…"     -> throws, i.e. a 500
 * </pre>
 *
 * <p>So the dangerous shapes are the ones with <i>no</i> leading slash — `@host` makes everything
 * before it userinfo — and the protocol-relative `//` form, the one people reach for first, is the
 * harmless one here. Requiring a single leading slash closes all of it.
 *
 * <p>Exploiting it needed a <i>successful</i> exchange, so a stranger could not have used it
 * without a valid code or token of yours; it never had to be reachable to be worth removing.
 */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw || !raw.startsWith("/")) return DEFAULT_NEXT;
  // "//host" and "/\host" are the two spellings browsers may read as "another origin".
  if (raw.startsWith("//") || raw.startsWith("/\\")) return DEFAULT_NEXT;
  return raw;
}

/**
 * What we say after a sign-up that produced no session, which is what a project with email
 * confirmation turned on always does.
 *
 * <p>Lives beside the callback because it is the other half of the same round trip: this sentence
 * is the hand-off, and `/auth/callback` is where the link in that email lands.
 *
 * <p>Deliberately phrased as a success. The old copy went through the modal's <i>error</i> state,
 * which told someone their account had been created correctly using the same red box used for
 * "that password is wrong".
 */
export const CONFIRM_EMAIL_MESSAGE =
  "Account created. Check your inbox for a confirmation link — and your spam folder — then log in.";

/**
 * Where Google should send somebody back to after they sign in.
 *
 * <p>Routed through `/auth/callback` because that is what exchanges the `?code=` Google returns
 * for a session — and `next` rides along as a query param because <b>an OAuth sign-in leaves the
 * page entirely.</b> That is the thing to keep in mind here: `AuthModal`'s `onAuthed` callback
 * cannot survive a full-page redirect to Google and back, so anything a caller would have done in
 * that callback has to be expressible as a destination instead.
 *
 * <p>`next` is re-checked server-side by {@link safeNextPath} when the callback runs, so a value
 * tampered with in the address bar cannot steer the redirect off-site; encoding it here is about
 * surviving the round trip intact, not about trust.
 */
export function oauthRedirectTo(origin: string, next: string): string {
  const base = origin.replace(/\/+$/, "");
  return `${base}/auth/callback?next=${encodeURIComponent(safeNextPath(next))}`;
}
