// A small inline loading spinner. Reach for this (or a skeleton) any time content
// is being fetched or a heavy view is rendering, so the user always has a visible
// signal that the app is working rather than a frozen-looking screen.
export function Spinner({
  className = "h-4 w-4",
  label = "Loading",
}: {
  /** Sizing + color, e.g. "h-5 w-5 text-accent". Color drives the ring. */
  className?: string;
  label?: string;
}) {
  return (
    <span
      role="status"
      aria-label={label}
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent opacity-70 ${className}`}
    />
  );
}
