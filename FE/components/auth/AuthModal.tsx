"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BrandMark } from "@/components/ui/BrandMark";

type Mode = "signup" | "login";

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
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  const heading = title ?? (mode === "login" ? "Welcome back" : "Create your account");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const supabase = createClient();
    try {
      if (mode === "login") {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
        // Email-confirmation projects return no session; we can't continue until
        // they confirm and log in.
        if (!data.session) {
          setError("Check your email to confirm your account, then log in.");
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
          ✕
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
                setMode(m);
              }}
              className={`rounded-full px-4 py-1.5 font-medium transition-colors disabled:opacity-50 ${
                mode === m
                  ? "bg-surface text-ink shadow-sm"
                  : "text-muted hover:text-ink"
              }`}
            >
              {m === "login" ? "Log in" : "Sign up"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="auth-email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              required
              autoFocus
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="focus-ring w-full rounded-input border border-line-strong bg-surface-2 px-3 py-2.5 text-sm text-ink outline-none transition placeholder:text-faint"
            />
          </div>

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
            {busy ? "Working…" : mode === "login" ? loginLabel : signupLabel}
          </button>
        </form>

        <p className="mt-4 text-center text-xs leading-relaxed text-faint">
          By continuing you agree to keep your decks tidy. No spam, ever.
        </p>
      </div>
    </div>
  );
}
