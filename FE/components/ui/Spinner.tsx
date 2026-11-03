"use client";

// A small inline loading spinner. Reach for this (or a skeleton) any time content
// is being fetched or a heavy view is rendering, so the user always has a visible
// signal that the app is working rather than a frozen-looking screen.
//
// `label` is screen-reader-only text. It falls back to the catalogue here rather than at each
// call site because around twenty callers omit it — translating it once covers all of them, and
// a caller with something more specific to say ("Saving", "Removing") still passes its own.
// Every file importing this is a client component (checked, not assumed), so the hook is safe.

import { useT } from "@/components/i18n/LocaleProvider";

export function Spinner({
  className = "h-4 w-4",
  label,
}: {
  /** Sizing + color, e.g. "h-5 w-5 text-accent". Color drives the ring. */
  className?: string;
  label?: string;
}) {
  const t = useT();
  return (
    <span
      role="status"
      aria-label={label ?? t("common.loading")}
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent opacity-70 ${className}`}
    />
  );
}
