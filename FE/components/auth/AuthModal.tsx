"use client";

import { useState } from "react";
import { Modal } from "@/components/shared/Modal";
import { createClient } from "@/lib/supabase/client";

type Mode = "signup" | "login";

// In-place login / sign-up modal (no navigation), so the page's state — e.g. a
// guest's just-imported deck — survives authentication. On success it awaits
// `onAuthed`, which the caller uses to run follow-up work (like saving the deck)
// before navigating; the modal shows a busy state until it resolves.
export function AuthModal({
  title = "Create an account",
  description,
  onClose,
  onAuthed,
  initialMode = "signup",
}: {
  title?: string;
  description?: string;
  onClose: () => void;
  onAuthed: () => Promise<void> | void;
  initialMode?: Mode;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
        // Email-confirmation projects return no session; we can't save until they
        // confirm and log in.
        if (!data.session) {
          setError("Check your email to confirm your account, then log in to save your deck.");
          setMode("login");
          setBusy(false);
          return;
        }
      }
      // Authenticated — run the caller's follow-up (save the deck, then navigate).
      await onAuthed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <div className="mx-auto max-w-sm space-y-4">
        {description && <p className="text-sm text-neutral-500">{description}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="auth-email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:focus:border-neutral-200"
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
              className="w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:focus:border-neutral-200"
            />
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
          >
            {busy
              ? "Working…"
              : mode === "login"
                ? "Log in & save"
                : "Sign up & save"}
          </button>
        </form>

        <p className="text-center text-sm text-neutral-500">
          {mode === "login" ? "No account yet?" : "Already have an account?"}{" "}
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setError(null);
              setMode(mode === "login" ? "signup" : "login");
            }}
            className="font-medium text-neutral-900 underline disabled:opacity-50 dark:text-neutral-100"
          >
            {mode === "login" ? "Sign up" : "Log in"}
          </button>
        </p>
      </div>
    </Modal>
  );
}
