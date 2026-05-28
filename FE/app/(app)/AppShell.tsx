"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import SignOutButton from "./SignOutButton";

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

  if (immersive) {
    // Full-bleed layout for the test screen. No sidebar, no top bar; the test
    // page renders its own End/Settings controls.
    return <div className="min-h-screen">{children}</div>;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar email={email} pathname={pathname} />
      <main className="min-w-0 flex-1 p-6 md:p-8">{children}</main>
    </div>
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
        <NavLink href="/import" pathname={pathname} label="Import deck" />
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
}: {
  href: string;
  pathname: string;
  label: string;
}) {
  // Treat the link as active when on the route itself or a deeper segment, so
  // e.g. /decks/<id> still highlights "Dashboard" in the section listing.
  const active = pathname === href;
  return (
    <Link
      href={href}
      className={`rounded-md px-2 py-1.5 transition-colors ${
        active
          ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
          : "text-neutral-600 hover:bg-neutral-200/60 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800/60 dark:hover:text-neutral-100"
      }`}
    >
      {label}
    </Link>
  );
}
