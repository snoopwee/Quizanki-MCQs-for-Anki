import Link from "next/link";

// 404. Lives at the app root, so it renders without the app sidebar — a calm
// full-screen page in the site's own styling.
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface-2 px-6 text-center">
      <p className="font-mono text-sm font-semibold uppercase tracking-[0.2em] text-accent">404</p>
      <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Page not found</h1>
      <p className="max-w-md text-sm leading-relaxed text-muted">
        The page you&apos;re looking for doesn&apos;t exist or may have moved.
      </p>
      <Link
        href="/home"
        className="focus-ring mt-2 inline-flex rounded-input bg-accent px-4 py-2 text-sm font-semibold text-white shadow-btn transition hover:opacity-95"
      >
        Go home
      </Link>
    </div>
  );
}
