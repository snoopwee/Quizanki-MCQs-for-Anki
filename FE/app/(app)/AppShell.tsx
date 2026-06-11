"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import SignOutButton from "./SignOutButton";
import { ImportProvider, useImportContext } from "@/components/import/ImportProvider";
import { BrandMark } from "@/components/ui/BrandMark";
import { Icon, type IconName } from "@/components/ui/icons";

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
  const [drawerOpen, setDrawerOpen] = useState(false);

  // The provider has to wrap the immersive route too so an import kicked off
  // from /import continues to surface its toast if the user jumps straight
  // into a quiz from another tab.
  if (immersive) {
    return (
      <ImportProvider>
        {/* Full-bleed layout for the test screen — the page renders its own controls. */}
        <div className="min-h-screen">{children}</div>
      </ImportProvider>
    );
  }

  return (
    <ImportProvider>
      <div className="flex min-h-screen">
        {/* Persistent sidebar on tablet/desktop. */}
        <Sidebar email={email} pathname={pathname} className="hidden md:flex md:sticky md:top-0" />

        {/* Off-canvas drawer on phones. */}
        {drawerOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setDrawerOpen(false)}
              className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
            />
            <Sidebar
              email={email}
              pathname={pathname}
              onNavigate={() => setDrawerOpen(false)}
              className="relative z-10 flex shadow-card"
            />
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Mobile top bar: hamburger + brand. */}
          <header className="flex items-center gap-3 border-b border-line bg-canvas/80 px-4 py-3 backdrop-blur md:hidden">
            <button
              type="button"
              aria-label="Open menu"
              onClick={() => setDrawerOpen(true)}
              className="grid h-10 w-10 place-items-center rounded-input border border-line bg-surface text-muted transition hover:text-ink"
            >
              <Icon name="menu" size={18} />
            </button>
            <BrandMark />
          </header>
          <main className="min-w-0 flex-1 p-5 md:p-8">{children}</main>
        </div>
      </div>
    </ImportProvider>
  );
}

function Sidebar({
  email,
  pathname,
  className = "",
  onNavigate,
}: {
  email: string;
  pathname: string;
  className?: string;
  onNavigate?: () => void;
}) {
  return (
    <aside
      className={`h-screen w-64 shrink-0 flex-col border-r border-line bg-surface px-4 py-5 ${className}`}
    >
      <Link href="/dashboard" className="px-2" onClick={onNavigate}>
        <BrandMark />
      </Link>

      <Link
        href="/import"
        onClick={onNavigate}
        className="mt-6 inline-flex items-center justify-center gap-2 rounded-input bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-btn transition hover:opacity-95"
      >
        <Icon name="plus" size={17} /> New deck
      </Link>

      <nav className="mt-6 flex flex-col gap-1 text-sm">
        <NavLink href="/dashboard" pathname={pathname} label="Dashboard" icon="home" onNavigate={onNavigate} />
        <NavLink
          href="/import"
          pathname={pathname}
          label="Import deck"
          icon="upload"
          onNavigate={onNavigate}
          trailing={<ImportPendingDot />}
        />
      </nav>

      <div className="mt-auto space-y-3 border-t border-line pt-4">
        <p className="truncate px-2 font-mono text-xs text-faint">{email}</p>
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
  icon,
  trailing,
  onNavigate,
}: {
  href: string;
  pathname: string;
  label: string;
  icon: IconName;
  // Optional inline indicator (e.g. a "saving…" spinner) that follows the user
  // between pages — the link sits in the sticky sidebar.
  trailing?: React.ReactNode;
  onNavigate?: () => void;
}) {
  const active = pathname === href;
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`flex items-center gap-3 rounded-input px-3 py-2 transition-colors ${
        active
          ? "bg-accent-soft font-semibold text-accent-ink"
          : "text-muted hover:bg-surface-2 hover:text-ink"
      }`}
    >
      <Icon name={icon} size={18} />
      <span className="flex-1">{label}</span>
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
