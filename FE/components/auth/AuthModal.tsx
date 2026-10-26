"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { BrandMark } from "@/components/ui/BrandMark";
import { UsernameField } from "@/components/auth/UsernameField";
import { useUsernameAvailability } from "@/hooks/useUsernameAvailability";
import { Icon } from "@/components/ui/icons";
import { looksAlreadySent, passwordResetRedirect, RESET_SENT_MESSAGE } from "@/lib/passwordReset";
import { CONFIRM_EMAIL_MESSAGE, oauthRedirectTo } from "@/lib/authCallback";
import { GoogleMark } from "@/components/auth/GoogleMark";
import { buttonClasses } from "@/components/ui/Button";

type Mode = "signup" | "login" | "forgot";

// In-place login / sign-up modal (no navigation), so the page's state — e.g. a
// guest's just-imported deck — survives authentication. On success it awaits
// `onAuthed`, which the caller uses to run follow-up work (like saving the deck)
// before navigating; the modal shows a busy state until it resolves.
export function AuthModal({
  title,
  description,
  onClose,
  onAuthed,
  initialMode = "signup",
  loginLabel = "Log in",
  signupLabel = "Sign up",
  confirmNotice = CONFIRM_EMAIL_MESSAGE,
  oauthNext,
}: {
  title?: string;
  description?: string;
  onClose: () => void;
  onAuthed: () => Promise<void> | void;
  initialMode?: Mode;
  // Submit-button labels per mode; the guest save flow overrides these (e.g.
  // "Log in & save") to make the follow-up action explicit.
  loginLabel?: string;
  signupLabel?: string;
  // Shown when sign-up needs an email confirmation before it can continue. Overridable because
  // the right words depend on what the caller was in the middle of — a guest saving a deck needs
  // to be told the deck is safe, which the generic sentence cannot say.
  confirmNotice?: string;
  // Where to land after signing in with Google. Needed as a PATH, not a callback, because an
  // OAuth sign-in navigates away from this page — `onAuthed` cannot survive the round trip to
  // Google and back. Defaults to wherever the modal was opened, which is right for the callers
  // whose follow-up work is simply "be here, signed in".
  oauthNext?: string;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Set once a reset email has been requested. Deliberately not an `error`: it is the success
  // state, and it says the same thing whether or not the address exists.
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  const heading =
    mode === "forgot"
      ? "Reset your password"
      : (title ?? (mode === "login" ? "Welcome back" : "Create your account"));

  // Same query key the field uses, so this is the same request, not a second one. Signing up is
  // gated on a known-good handle: letting it through and fixing it afterwards is how you end up
  // with accounts whose handle nobody chose.
  // No ownHandle here: signing up, there is no account yet and nothing of theirs to collide with.
  const handleReady = useUsernameAvailability(username, mode === "signup").available;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    // Any new submit supersedes the last outcome. Without this, signing up (which leaves the
    // green "check your inbox") and then failing the login below would show both boxes at once.
    setNotice(null);
    setBusy(true);

    const supabase = createClient();
    try {
      if (mode === "forgot") {
        // Supabase answers success whether or not the address is registered, and so do we —
        // see RESET_SENT_MESSAGE. The only errors worth surfacing are transport ones, and a
        // rate-limit is not one: it only happens for an address that HAS an account, so showing
        // it would hand back the enumeration oracle that message exists to close.
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: passwordResetRedirect(window.location.origin),
        });
        if (resetError && !looksAlreadySent(resetError)) throw resetError;
        setNotice(RESET_SENT_MESSAGE);
        setBusy(false);
        return;
      }

      if (mode === "login") {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          // The handle rides along in user_metadata rather than being claimed with an API call:
          // an email-confirmation project hands back no session here, so there would be no token
          // to call with. The backend treats it as a REQUEST and re-checks it before honouring it.
          //
          // display_name is set to the same value because there is only ONE name — the username
          // is what credits their decks, and `Caller` reads it off the token.
          options: { data: { username: username.trim(), display_name: username.trim() } },
        });
        if (signUpError) throw signUpError;
        // Email-confirmation projects return no session; we can't continue until they confirm
        // and log in. That is the account being created CORRECTLY, so it goes through `notice`,
        // not `error` — the red box is for "that password is wrong", not for good news.
        if (!data.session) {
          setNotice(confirmNotice);
          setMode("login");
          setBusy(false);
          return;
        }
      }
      await onAuthed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  async function signInWithGoogle() {
    setError(null);
    setNotice(null);
    setBusy(true);
    const here = `${window.location.pathname}${window.location.search}`;
    const { error: oauthError } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: oauthRedirectTo(window.location.origin, oauthNext ?? here) },
    });
    // On success the browser is already leaving for Google, so `busy` deliberately stays true —
    // clearing it would flash an interactive form during the navigation.
    if (oauthError) {
      setError(oauthError.message);
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink/50 p-4 backdrop-blur-sm"
      onClick={() => !busy && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={heading}
        onClick={(e) => e.stopPropagation()}
        className="rise relative my-8 w-full max-w-[25.5rem] rounded-[18px] border border-line bg-surface p-7 shadow-card"
      >
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          aria-label="Close"
          className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-input text-faint transition hover:bg-surface-2 hover:text-ink disabled:opacity-40"
        >
          <Icon name="x" size={16} />
        </button>

        <BrandMark />
        <h2 className="font-display mt-4 text-2xl font-semibold tracking-tight">{heading}</h2>
        {description && (
          <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p>
        )}

        {/* Segmented mode toggle */}
        <div className="mt-5 grid grid-cols-2 gap-1 rounded-full bg-surface-2 p-1 text-sm">
          {(["login", "signup"] as const).map((m) => (
            <button
              key={m}
              type="button"
              disabled={busy}
              onClick={() => {
                setError(null);
                setNotice(null);
                setMode(m);
              }}
              className={`rounded-full px-4 py-1.5 font-medium transition-colors disabled:opacity-50 ${
                m === mode || (mode === "forgot" && m === "login")
                  ? "bg-surface text-ink shadow-sm"
                  : "text-muted hover:text-ink"
              }`}
            >
              {m === "login" ? "Log in" : "Sign up"}
            </button>
          ))}
        </div>

        {mode !== "forgot" && (
          <>
            <button
              type="button"
              onClick={signInWithGoogle}
              disabled={busy}
              className={buttonClasses({ variant: "ghost", size: "md", className: "mt-5 w-full" })}
            >
              <GoogleMark />
              Continue with Google
            </button>

            {/* Divider. The line is drawn either side of the word rather than behind it, so no
                background has to be faked to punch a hole in it. */}
            <div className="mt-4 flex items-center gap-3" aria-hidden="true">
              <span className="h-px flex-1 bg-line" />
              <span className="text-xs text-faint">or</span>
              <span className="h-px flex-1 bg-line" />
            </div>
          </>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {mode === "signup" && (
            <UsernameField
              id="auth-username"
              value={username}
              onChange={setUsername}
              disabled={busy}
              hint="You can change this later."
            />
          )}

          <div className="space-y-1.5">
            <label htmlFor="auth-email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              required
              autoFocus={mode === "login"}
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="focus-ring w-full rounded-input border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-ink outline-none transition placeholder:text-faint"
            />
          </div>

          {mode !== "forgot" && (
          <div className="space-y-1.5">
            <label htmlFor="auth-password" className="text-sm font-medium">
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              required
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="focus-ring w-full rounded-input border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-ink outline-none transition placeholder:text-faint"
            />
          </div>
          )}

          {/* The link that closes the worst hole in the product: before this, forgetting your
              password meant permanent lockout. Login only — it is meaningless while signing up. */}
          {mode === "login" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setError(null);
                setNotice(null);
                setMode("forgot");
              }}
              className="focus-ring -mt-1 block text-xs font-medium text-accent-ink underline-offset-2 hover:underline disabled:opacity-50"
            >
              Forgot your password?
            </button>
          )}

          {mode === "forgot" && (
            <p className="-mt-1 text-xs leading-relaxed text-muted">
              Enter the address you signed up with and we&apos;ll send you a link to set a new
              password.
            </p>
          )}

          {notice && (
            <p className="rounded-input border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
              {notice}
            </p>
          )}

          {error && (
            <p className="rounded-input border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || (mode === "signup" && !handleReady)}
            className="focus-ring w-full rounded-input bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-btn transition hover:opacity-95 disabled:opacity-50"
          >
            {busy
              ? "Working…"
              : mode === "forgot"
                ? "Send reset link"
                : mode === "login"
                  ? loginLabel
                  : signupLabel}
          </button>

          {mode === "forgot" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setError(null);
                setNotice(null);
                setMode("login");
              }}
              className="focus-ring w-full text-center text-xs font-medium text-muted hover:text-ink disabled:opacity-50"
            >
              ← Back to log in
            </button>
          )}
        </form>

        {/* "By continuing you agree to..." has to name what, now that there is something to name.
            The old line finished that sentence with a joke, which was fine while no terms existed
            and is not once they do — this is the click the agreement is attached to. */}
        <p className="mt-4 text-center text-xs leading-relaxed text-faint">
          By continuing you agree to our{" "}
          <Link href="/terms" className="underline underline-offset-2 transition hover:text-ink">
            terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline underline-offset-2 transition hover:text-ink">
            privacy policy
          </Link>
          . No spam, ever.
        </p>
      </div>
    </div>
  );
}
