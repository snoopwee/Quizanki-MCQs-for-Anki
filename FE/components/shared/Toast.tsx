"use client";

import { useEffect, useState } from "react";

// Fixed-position, dismissable status toast. Designed for the import auto-save:
// the page passes its mutation status, the toast picks the matching variant,
// and a successful save auto-dismisses after a short hold so the screen stays
// uncluttered. Pending and error variants stay until the state changes (or the
// user clicks the close affordance), so the user never misses a problem.
type ToastKind = "pending" | "success" | "error";

const KIND_STYLES: Record<ToastKind, string> = {
  pending:
    "border-neutral-200 bg-white text-neutral-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200",
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/60 dark:text-emerald-200",
  error:
    "border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-200",
};

const SUCCESS_AUTO_DISMISS_MS = 3000;

export function Toast({
  kind,
  message,
  actionLabel,
  onAction,
  onDismiss,
}: {
  kind: ToastKind;
  message: string;
  // Optional inline action — used for the error "Retry" button.
  actionLabel?: string;
  onAction?: () => void;
  onDismiss: () => void;
}) {
  // Re-enter animation when the toast remounts for a new state.
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (kind !== "success") return;
    const id = window.setTimeout(onDismiss, SUCCESS_AUTO_DISMISS_MS);
    return () => window.clearTimeout(id);
  }, [kind, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-6 right-6 z-50 flex items-center gap-3 rounded-lg border px-4 py-2.5 text-sm shadow-lg transition-all duration-200 ${
        KIND_STYLES[kind]
      } ${entered ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"}`}
    >
      {kind === "pending" && (
        <span
          aria-hidden
          className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-neutral-400 border-t-transparent"
        />
      )}
      {kind === "success" && <span aria-hidden>✓</span>}
      {kind === "error" && <span aria-hidden>!</span>}
      <span>{message}</span>
      {actionLabel && onAction && (
        <button type="button" onClick={onAction} className="font-medium underline">
          {actionLabel}
        </button>
      )}
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="ml-1 rounded px-1 text-neutral-500 hover:bg-black/5 dark:hover:bg-white/10"
      >
        ✕
      </button>
    </div>
  );
}
