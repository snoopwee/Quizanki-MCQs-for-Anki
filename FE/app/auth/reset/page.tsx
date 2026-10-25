"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AppChrome } from "@/components/layout/AppChrome";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/Spinner";
import { buttonClasses } from "@/components/ui/Button";
import {
  MIN_PASSWORD,
  RECOVERY_PROBLEMS,
  readRecoveryLink,
  validateNewPassword,
  type RecoveryProblem,
} from "@/lib/passwordReset";

/**
 * Where a password-reset email lands — and the one place that turns a recovery link into a
 * session.
 *
 * <p>The email points here directly rather than at {@code /auth/callback}; see
 * {@code passwordResetRedirect} for why. The short version: Supabase returns the credentials in
 * the query string for some links and in the URL <i>fragment</i> for others, and a fragment never
 * reaches the server, so a route handler cannot be the thing that reads them. This is a client
 * page, so it can see both.
 *
 * <p>Outside the {@code (app)} route group: someone resetting a password is, by definition, in the
 * middle of not being able to sign in, and the guard on that group would bounce them to the
 * landing page before the recovery session was read.
 */
export default function ResetPasswordPage() {
  const router = useRouter();

  // "checking" until we know whether a recovery session could be established. Rendering the form
  // first and failing on submit would waste the one-time link on a confusing error.
  const [status, setStatus] = useState<"checking" | "ready" | "invalid" | "done">("checking");
  const [problem, setProblem] = useState<RecoveryProblem>("missing");
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const link = readRecoveryLink(window.location.search, window.location.hash);

      if (link.kind === "error") {
        if (!cancelled) {
          setProblem(link.reason);
          setStatus("invalid");
        }
        return;
      }

      // Spend whatever the link carried. Failures are deliberately NOT fatal here: the Supabase
      // client auto-exchanges a ?code= during its own start-up, so losing the race and being told
      // the code is already spent is a success in disguise. getUser() below is the real verdict.
      if (link.kind === "code") {
        await supabase.auth.exchangeCodeForSession(link.code).catch(() => undefined);
      } else if (link.kind === "tokens") {
        // The implicit shape. supabase-js refuses to read it itself — @supabase/ssr defaults to
        // flowType "pkce", and _getSessionFromURL throws "Not a valid PKCE flow url" on a
        // fragment — so setting the session by hand is the only way these tokens get used.
        await supabase.auth
          .setSession({ access_token: link.accessToken, refresh_token: link.refreshToken })
          .catch(() => undefined);
      }

      // Get the tokens out of the address bar before anything else can read them: they would
      // otherwise sit in history and ride along in the Referer header of any outbound request.
      if (link.kind !== "none") {
        window.history.replaceState({}, "", "/auth/reset");
      }

      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      if (data.user) {
        setEmail(data.user.email ?? null);
        setStatus("ready");
        return;
      }

      // A code that would not exchange almost always means the PKCE verifier lives in another
      // browser — the reset was requested somewhere else. That has a different fix from an
      // expired link, so it gets different words.
      setProblem(link.kind === "code" ? "wrong-browser" : link.kind === "tokens" ? "expired" : "missing");
      setStatus("invalid");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const problemWithPassword = validateNewPassword(password, confirm);
    if (problemWithPassword) {
      setError(problemWithPassword);
      return;
    }
    setError(null);
    setBusy(true);

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);

    if (updateError) {
      // Supabase surfaces "same as the old password" and expired-session cases here.
      setError(updateError.message || "Couldn't set your new password.");
      return;
    }
    setStatus("done");
  }

  if (status === "checking") {
    return (
      <AppChrome>
        <div className="mx-auto flex max-w-md items-center gap-3 p-6 text-sm text-muted">
          <Spinner className="h-4 w-4" /> Checking your link…
        </div>
      </AppChrome>
    );
  }

  if (status === "invalid") {
    const copy = RECOVERY_PROBLEMS[problem];
    return (
      <AppChrome>
        <div className="mx-auto max-w-md">
          <Card className="flex flex-col items-center gap-3 border-dashed px-6 py-12 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-surface-2 text-muted">
              <Icon name="lock" size={22} />
            </span>
            <p className="text-sm font-medium text-ink">{copy.title}</p>
            <p className="max-w-xs text-sm leading-relaxed text-muted">{copy.body}</p>
            <Link href="/" className={buttonClasses({ variant: "primary", size: "sm" })}>
              Back to Quizanki
            </Link>
          </Card>
        </div>
      </AppChrome>
    );
  }

  if (status === "done") {
    return (
      <AppChrome>
        <div className="mx-auto max-w-md">
          <Card className="flex flex-col items-center gap-3 px-6 py-12 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-success/15 text-success">
              <Icon name="check" size={22} />
            </span>
            <p className="text-sm font-medium text-ink">Password updated.</p>
            <p className="max-w-xs text-sm leading-relaxed text-muted">
              You&apos;re signed in on this device. Use the new password next time.
            </p>
            <button
              type="button"
              onClick={() => router.push("/home")}
              className={buttonClasses({ variant: "primary", size: "sm" })}
            >
              Go to Home
            </button>
          </Card>
        </div>
      </AppChrome>
    );
  }

  return (
    <AppChrome>
      <div className="mx-auto max-w-md">
        <Card className="p-6">
          <h1 className="font-display text-xl font-semibold tracking-tight text-ink">
            Set a new password
          </h1>
          <p className="mt-1 text-sm text-muted">
            Choose something you haven&apos;t used here before.
          </p>

          <form onSubmit={submit} className="mt-5 space-y-4">
            {/* Two jobs, both worth the row. It shows WHOSE password is about to change — people
                with a second account otherwise find out afterwards — and it gives the browser's
                password manager a username to file the new password under. Chrome warns about a
                password form with no username field precisely because, without one, a saved
                credential has no account attached to it. Read-only: this is not the screen for
                changing your address. */}
            <div className="space-y-1.5">
              <label htmlFor="reset-email" className="text-sm font-medium">
                Account
              </label>
              <input
                id="reset-email"
                type="email"
                readOnly
                autoComplete="username"
                value={email ?? ""}
                tabIndex={-1}
                className="w-full cursor-default rounded-input border border-line bg-surface-2/60 px-3 py-2.5 text-sm text-muted outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="new-password" className="text-sm font-medium">
                New password
              </label>
              <input
                id="new-password"
                type="password"
                required
                autoFocus
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={`At least ${MIN_PASSWORD} characters`}
                className="focus-ring w-full rounded-input border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-ink outline-none transition placeholder:text-faint"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="confirm-password" className="text-sm font-medium">
                Confirm new password
              </label>
              <input
                id="confirm-password"
                type="password"
                required
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                className="focus-ring w-full rounded-input border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-ink outline-none transition placeholder:text-faint"
              />
            </div>

            {error && (
              <p className="rounded-input border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="focus-ring w-full rounded-input bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-btn transition hover:opacity-95 disabled:opacity-50"
            >
              {busy ? "Saving…" : "Set new password"}
            </button>
          </form>
        </Card>
      </div>
    </AppChrome>
  );
}
