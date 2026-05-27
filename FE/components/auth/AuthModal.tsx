"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

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
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm"
      onClick={() => !busy && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={heading}
        onClick={(e) => e.stopPropagation()}
        className="rise relative my-8 w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-7 shadow-2xl dark:border-neutral-800 dark:bg-neutral-950"
      >
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-md px-2 py-1 text-sm text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-40 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
        >
          ✕
        </button>

        <p className="font-display text-sm tracking-tight text-neutral-400 dark:text-neutral-500">
          Quizanki
        </p>
        <h2 className="font-display mt-1 text-2xl font-semibold tracking-tight">{heading}</h2>
        {description && (
          <p className="mt-2 text-sm leading-relaxed text-neutral-500">{description}</p>
        )}

        {/* Segmented mode toggle */}
        <div className="mt-5 grid grid-cols-2 gap-1 rounded-full bg-neutral-100 p-1 text-sm dark:bg-neutral-900">
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
                  ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white"
                  : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
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
              className="w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-4 focus:ring-neutral-900/5 dark:border-neutral-700 dark:focus:border-neutral-200 dark:focus:ring-neutral-100/10"
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
              className="w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2.5 text-sm outline-none transition-colors placeholder:text-neutral-400 focus:border-neutral-900 focus:ring-4 focus:ring-neutral-900/5 dark:border-neutral-700 dark:focus:border-neutral-200 dark:focus:ring-neutral-100/10"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            {busy ? "Working…" : mode === "login" ? loginLabel : signupLabel}
          </button>
        </form>

        <p className="mt-4 text-center text-xs leading-relaxed text-neutral-400">
          By continuing you agree to keep your decks tidy. No spam, ever.
        </p>
      </div>
    </div>
  );
}
