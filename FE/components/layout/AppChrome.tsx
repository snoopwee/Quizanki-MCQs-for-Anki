"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import { AppShell } from "@/app/(app)/AppShell";
import { useSession } from "@/hooks/useSession";
import { BrandMark } from "@/components/ui/BrandMark";

/**
 * Page chrome for routes that live OUTSIDE the `(app)` auth group but still want
 * the app's navigation — Discover and the shared-deck page. Those pages must open
 * for guests, so they can't use `(app)/layout.tsx` (which redirects when there's
 * no session); this picks the right frame at runtime instead.
 *
 *  - **Signed in** → the full {@link AppShell}: the sidebar is how you get around
 *    the app, so a page without it feels detached. Same shell the `(app)` layout
 *    renders, so Discover looks like part of the app.
 *  - **Guest** (and the brief pre-session tick) → a minimal public header. None
 *    of the app nav is reachable without an account, so showing it would only
 *    lead to login bounces.
 *
 * The page body is rendered the same way in both, so a page written for this
 * chrome needs no header of its own — just its content, `mx-auto max-w-*`.
 */
export function AppChrome({ children }: { children: ReactNode }) {
  const { user, loading } = useSession();

  if (user) {
    return <AppShell email={user.email ?? ""}>{children}</AppShell>;
  }

  return (
    <div className="relative min-h-screen">
      <div aria-hidden className="landing-grid pointer-events-none absolute inset-0 -z-10" />
      <header className="sticky top-0 z-40 border-b border-line bg-canvas/80 backdrop-blur">
        <div className="flex items-center justify-between px-6 py-4 sm:px-8">
          <Link href="/">
            <BrandMark />
          </Link>
          {/* Hidden until the session resolves, so an authed user mid-load doesn't
              flash a "Log in" button before the sidebar takes over. */}
          {!loading && (
            <Link
              href="/"
              className="rounded-full border border-line-strong bg-surface px-4 py-1.5 text-sm font-semibold text-ink transition hover:border-accent hover:text-accent"
            >
              Log in
            </Link>
          )}
        </div>
      </header>
      <main className="p-5 md:p-8">{children}</main>
    </div>
  );
}
