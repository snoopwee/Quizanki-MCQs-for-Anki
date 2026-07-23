"use client";

import { useEffect } from "react";

/**
 * "You haven't saved this deck yet" — shown when the user tries to navigate away
 * from the import review screen mid-edit. Leaving is still allowed (it's their
 * call), but it shouldn't happen by accident on the way to another page.
 */
export function ConfirmLeaveModal({
  onStay,
  onLeave,
}: {
  onStay: () => void;
  onLeave: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onStay();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onStay]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Leave without saving?"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
      onClick={onStay}
    >
      <div
        className="w-full max-w-sm space-y-4 rounded-card border border-line bg-surface p-5 shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 className="font-display text-base font-semibold tracking-tight">
            This deck isn&apos;t saved yet
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            It won&apos;t be added to your decks until you hit Save. We&apos;ll keep a copy on this
            device, so you can pick it up where you left off.
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onLeave}
            className="rounded-input border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium text-muted transition hover:border-danger hover:text-danger"
          >
            Leave anyway
          </button>
          <button
            type="button"
            onClick={onStay}
            autoFocus
            className="focus-ring rounded-input bg-accent px-3 py-1.5 text-sm font-semibold text-white shadow-btn transition hover:opacity-95"
          >
            Keep editing
          </button>
        </div>
      </div>
    </div>
  );
}
