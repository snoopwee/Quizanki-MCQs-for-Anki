"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import SignOutButton from "./SignOutButton";
import { ImportProvider, useImportContext } from "@/components/import/ImportProvider";

// True for any URL the running quiz takes over — sidebar is hidden so the test
// occupies the full screen (less chrome, fewer distractions). Other deck
// sub-routes (detail, settings later) keep the sidebar.
function isImmersiveRoute(pathname: string): boolean {
  return /\/decks\/[^/]+\/test\b/.test(pathname);
}

export function AppShell({
  email,
  children,
}: {
  email: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const immersive = isImmersiveRoute(pathname);

  // The provider has to wrap the immersive route too so an import kicked off
  // from /import continues to surface its toast if the user jumps straight
  // into a quiz from another tab.
  return (
    <ImportProvider>
      {immersive ? (
        // Full-bleed layout for the test screen. No sidebar, no top bar; the test
        // page renders its own End/Settings controls.
        <div className="min-h-screen">{children}</div>
      ) : (
        <div className="flex min-h-screen">
          <Sidebar email={email} pathname={pathname} />
          <main className="min-w-0 flex-1 p-6 md:p-8">{children}</main>
        </div>
      )}
    </ImportProvider>
  );
}

function Sidebar({ email, pathname }: { email: string; pathname: string }) {
  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-neutral-200 bg-neutral-50/60 px-4 py-5 dark:border-neutral-800 dark:bg-neutral-950/60">
      <Link href="/dashboard" className="font-display px-2 text-lg font-semibold tracking-tight">
        Quizanki
        <span className="text-neutral-300 dark:text-neutral-600">.</span>
      </Link>

      <nav className="mt-8 flex flex-col gap-1 text-sm">
        <NavLink href="/dashboard" pathname={pathname} label="Dashboard" />
        <NavLink href="/import" pathname={pathname} label="Import deck" trailing={<ImportPendingDot />} />
      </nav>

      <div className="mt-auto space-y-3 border-t border-neutral-200 pt-4 dark:border-neutral-800">
        <p className="truncate px-2 text-xs text-neutral-500">{email}</p>
        <div className="px-2">
          <SignOutButton />
        </div>
      </div>
    </aside>
  );
}

function NavLink({
  href,
  pathname,
  label,
  trailing,
}: {
  href: string;
  pathname: string;
  label: string;
  // Optional inline indicator (e.g. a "saving…" spinner) that follows the user
  // between pages — the link sits in the sticky sidebar.
  trailing?: React.ReactNode;
}) {
  // Treat the link as active when on the route itself or a deeper segment, so
  // e.g. /decks/<id> still highlights "Dashboard" in the section listing.
  const active = pathname === href;
  return (
    <Link
      href={href}
      className={`flex items-center justify-between rounded-md px-2 py-1.5 transition-colors ${
        active
          ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
          : "text-neutral-600 hover:bg-neutral-200/60 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800/60 dark:hover:text-neutral-100"
      }`}
    >
      <span>{label}</span>
      {trailing}
    </Link>
  );
}

// A small spinner next to the Import-deck link while a save is in flight, so
// the user has a persistent cue even if they've dismissed the toast.
function ImportPendingDot() {
  const { status } = useImportContext();
  if (status !== "pending") return null;
  return (
    <span
      aria-label="Saving deck"
      title="Saving deck…"
      className="inline-block h-2.5 w-2.5 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70"
    />
  );
}
