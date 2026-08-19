"use client";

import { useEffect } from "react";
import Link from "next/link";

// Route-level error boundary. Catches a render/data error in a page and shows a
// recoverable screen instead of a blank one — `reset` re-renders the segment.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface-2 px-6 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-full bg-danger/10 text-danger">
        <span className="font-display text-2xl font-bold">!</span>
      </span>
      <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Something went wrong</h1>
      <p className="max-w-md text-sm leading-relaxed text-muted">
        An unexpected error occurred. You can try again, or head back home.
      </p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={reset}
          className="focus-ring rounded-input bg-accent px-4 py-2 text-sm font-semibold text-white shadow-btn transition hover:opacity-95"
        >
          Try again
        </button>
        <Link
          href="/home"
          className="focus-ring rounded-input border border-line-strong bg-surface px-4 py-2 text-sm font-medium text-muted transition hover:text-ink"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
