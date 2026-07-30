"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ImportProvider, useImportContext } from "@/components/import/ImportProvider";
import { useMe } from "@/hooks/useMe";
import { ADMIN_SECTIONS } from "@/lib/adminNav";
import { AccountMenu } from "@/components/account/AccountMenu";
import { BrandMark } from "@/components/ui/BrandMark";
import { DeckSearch } from "@/components/search/DeckSearch";
import { Icon, type IconName } from "@/components/ui/icons";

// True for any URL a full-screen study mode takes over — sidebar is hidden so the
// test / match game occupies the full screen (less chrome, fewer distractions).
// Other deck sub-routes (detail, settings) keep the sidebar.
function isImmersiveRoute(pathname: string): boolean {
  return /\/decks\/[^/]+\/(test|match)\b/.test(pathname);
}

const PIN_KEY = "quizanki:sidebar-pinned";

function readPinned(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(PIN_KEY) === "1";
  } catch {
    return false;
  }
}

function storePinned(v: boolean): void {
  try {
    window.localStorage.setItem(PIN_KEY, v ? "1" : "0");
  } catch {
    /* ignore */
  }
}

// A sidebar label that grows out beside its (stationary) icon as the rail
// expands. Animating max-width + opacity — not layout position — keeps the icon
// perfectly still, so nothing jolts on hover. The span clips its own text, so
// the aside itself needs no overflow clip (the account flyout can still escape).
function RevealLabel({
  show,
  children,
  className = "",
}: {
  show: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`overflow-hidden whitespace-nowrap transition-all duration-200 ease-out ${
        show ? "ml-1 max-w-[10rem] opacity-100" : "ml-0 max-w-0 opacity-0"
      } ${className}`}
    >
      {children}
    </span>
  );
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

  // Desktop rail model:
  //  - pinned  → docked open; the main content reserves its full width.
  //  - !pinned → "hover mode": a slim rail that expands on hover/focus, floating
  //              OVER the content (the reserved width stays slim, so nothing
  //              shifts). Read the pin pref after mount (server can't see it).
  const [pinned, setPinned] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => setPinned(readPinned()), []);

  // Expanded when docked, hovered/focused, or while the account menu is open (so
  // it can't collapse out from under an open flyout).
  const expanded = pinned || hovering || menuOpen;

  function togglePin() {
    setPinned((p) => {
      const next = !p;
      storePinned(next);
      return next;
    });
  }

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
        {/* Layout spacer — reserves the docked width (slim in hover mode so the
            hover-expand floats over content instead of pushing it). */}
        <div
          aria-hidden
          className={`hidden shrink-0 transition-[width] duration-200 ease-out md:block ${
            pinned ? "w-64" : "w-16"
          }`}
        />

        {/* The rail itself is fixed, so in hover mode its expansion overlays the
            page rather than reflowing it. */}
        <Sidebar
          email={email}
          pathname={pathname}
          expanded={expanded}
          pinned={pinned}
          floating={!pinned && expanded}
          onTogglePin={togglePin}
          onHoverChange={setHovering}
          onMenuOpenChange={setMenuOpen}
          className="fixed inset-y-0 left-0 z-40 hidden md:flex"
        />

        {/* Off-canvas drawer on phones — always full width (never collapsed). */}
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
              expanded
              onNavigate={() => setDrawerOpen(false)}
              className="relative z-10 flex shadow-card"
            />
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Top navbar. Hamburger + brand show only on mobile (the rail is a
              drawer there); the deck search rides on every size. Sticky so it
              stays reachable as the page scrolls. */}
          <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-canvas/80 px-4 py-3 backdrop-blur md:px-8">
            <button
              type="button"
              aria-label="Open menu"
              onClick={() => setDrawerOpen(true)}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-input border border-line bg-surface text-muted transition hover:text-ink md:hidden"
            >
              <Icon name="menu" size={18} />
            </button>
            <div className="md:hidden">
              <BrandMark />
            </div>
            <div className="min-w-0 flex-1 md:max-w-md">
              <DeckSearch />
            </div>
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
  expanded,
  pinned = false,
  floating = false,
  onTogglePin,
  onHoverChange,
  onMenuOpenChange,
  onNavigate,
}: {
  email: string;
  pathname: string;
  className?: string;
  expanded: boolean;
  pinned?: boolean;
  // True while the rail is hover-expanded over the content — adds a lift shadow.
  floating?: boolean;
  // Desktop only — pin/unpin toggle + hover/menu wiring. Absent in the drawer.
  onTogglePin?: () => void;
  onHoverChange?: (hovering: boolean) => void;
  onMenuOpenChange?: (open: boolean) => void;
  onNavigate?: () => void;
}) {
  // Which rail to show — admin or study — is decided by /me. Until it resolves the
  // role is UNKNOWN, so we render a neutral placeholder rather than defaulting to
  // the study nav (which flashed the normal sidebar at admins on a cold load). Once
  // cached, this is instant on later navigations. The /admin route + endpoints are
  // gated server-side regardless of what the sidebar shows.
  const me = useMe();
  const isAdmin = me.data?.isAdmin ?? false;
  const roleKnown = !me.isPending;
  return (
    <aside
      onMouseEnter={onHoverChange ? () => onHoverChange(true) : undefined}
      onMouseLeave={onHoverChange ? () => onHoverChange(false) : undefined}
      onFocus={onHoverChange ? () => onHoverChange(true) : undefined}
      onBlur={
        onHoverChange
          ? (e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) onHoverChange(false);
            }
          : undefined
      }
      // Constant horizontal padding so the icon column never shifts — only the
      // width and the labels animate.
      className={`h-screen shrink-0 flex-col border-r border-line bg-surface px-3 py-5 pb-3 transition-[width] duration-200 ease-out ${
        expanded ? "w-64" : "w-16"
      } ${floating ? "shadow-card" : ""} ${className}`}
    >
      {/* Brand + pin toggle. The 40px logo tile matches the "New deck" tile below 
          and fills the slim rail (so it's centred). The toggle only shows while
          expanded and carries a border, lined up with the nav tabs' right edge. */}
      <div className="flex h-10 items-center">
        <Link
          href={isAdmin ? "/admin" : "/home"}
          onClick={onNavigate}
          aria-label={isAdmin ? "Admin" : "Home"}
          className="flex min-w-0 items-center"
        >
          <BrandMark size="lg" withWordmark={false} />
          <RevealLabel show={expanded} className="font-display text-lg font-semibold tracking-tight">
            Quizanki<span className="text-accent">.</span>
            {isAdmin && <span className="ml-1 text-xs font-semibold uppercase tracking-wide text-muted">admin</span>}
          </RevealLabel>
        </Link>
        {onTogglePin && expanded && (
          <button
            type="button"
            onClick={onTogglePin}
            aria-label={pinned ? "Switch to hover mode" : "Pin sidebar open"}
            aria-pressed={pinned}
            title={pinned ? "Switch to hover mode" : "Pin sidebar open"}
            className={`ml-auto grid h-8 w-8 shrink-0 place-items-center rounded-input border transition ${
              pinned
                ? "border-accent/40 bg-accent-soft text-accent-ink"
                : "border-line-strong text-muted hover:bg-surface-2 hover:text-ink"
            }`}
          >
            <Icon name={pinned ? "chevronLeft" : "chevronRight"} size={15} />
          </button>
        )}
      </div>

      {/* An admin account isn't for studying, so it gets an admin-focused rail
          instead of the New deck / Home / Import study nav. It can still open and
          view any deck (Browse decks → Discover) and its own profile (account
          menu). Everyone else gets the normal study nav. Until /me resolves we
          don't know which, so show a neutral skeleton — never the wrong rail. */}
      {!roleKnown ? (
        <NavSkeleton expanded={expanded} />
      ) : isAdmin ? (
        <nav className="mt-6 flex flex-col gap-1 text-sm">
          {ADMIN_SECTIONS.map((s) =>
            s.ready ? (
              <NavLink
                key={s.href}
                href={s.href}
                pathname={pathname}
                label={s.label}
                icon={s.icon}
                expanded={expanded}
                onNavigate={onNavigate}
              />
            ) : (
              <SoonNavItem key={s.href} label={s.label} icon={s.icon} expanded={expanded} />
            ),
          )}
          <div className="my-2 border-t border-line" />
          {/* Admins don't study, but they still need to reach the normal site —
              Home and any deck's content. */}
          <NavLink
            href="/home"
            pathname={pathname}
            label="Home"
            icon="home"
            expanded={expanded}
            onNavigate={onNavigate}
          />
          <NavLink
            href="/discover"
            pathname={pathname}
            label="Browse decks"
            icon="search"
            expanded={expanded}
            onNavigate={onNavigate}
          />
        </nav>
      ) : (
        <>
          {/* Primary CTA — 40px plus tile stays put, label grows out. */}
          <Link
            href="/import"
            onClick={onNavigate}
            title={expanded ? undefined : "New deck"}
            className="mt-6 flex h-10 items-center rounded-input bg-accent font-semibold text-white shadow-btn transition hover:opacity-95"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center">
              <Icon name="plus" size={18} />
            </span>
            <RevealLabel show={expanded} className="text-sm">
              New deck
            </RevealLabel>
          </Link>

          <nav className="mt-6 flex flex-col gap-1 text-sm">
            <NavLink href="/home" pathname={pathname} label="Home" icon="home" expanded={expanded} onNavigate={onNavigate} />
            <NavLink href="/discover" pathname={pathname} label="Discover" icon="search" expanded={expanded} onNavigate={onNavigate} />
            <NavLink
              href="/import"
              pathname={pathname}
              label="Import deck"
              icon="upload"
              expanded={expanded}
              onNavigate={onNavigate}
              trailing={<ImportPendingDot />}
            />
          </nav>
        </>
      )}

      <div className="mt-auto border-t border-line pt-3">
        <AccountMenu
          email={email}
          collapsed={!expanded}
          side={onHoverChange ? "right" : "top"}
          onNavigate={onNavigate}
          onOpenChange={onMenuOpenChange}
        />
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
  expanded = true,
  onNavigate,
}: {
  href: string;
  pathname: string;
  label: string;
  icon: IconName;
  // Optional inline indicator (e.g. a "saving…" spinner) that follows the user
  // between pages. Only rendered when expanded.
  trailing?: React.ReactNode;
  expanded?: boolean;
  onNavigate?: () => void;
}) {
  const active = pathname === href;
  return (
    <Link
      href={href}
      onClick={onNavigate}
      title={expanded ? undefined : label}
      className={`flex h-10 items-center rounded-input transition-colors ${
        active
          ? "bg-accent-soft font-semibold text-accent-ink"
          : "text-muted hover:bg-surface-2 hover:text-ink"
      }`}
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center">
        <Icon name={icon} size={18} />
      </span>
      <RevealLabel show={expanded} className="flex flex-1 items-center gap-2">
        <span className="flex-1">{label}</span>
        {trailing}
      </RevealLabel>
    </Link>
  );
}

// Neutral nav placeholder shown while /me is still resolving, so a cold load never
// flashes the study rail at an admin (or vice-versa). Pulse rows sit where the nav
// links will land; collapses to icon-width dots like the real rail.
function NavSkeleton({ expanded }: { expanded: boolean }) {
  return (
    <div className="mt-6 flex flex-col gap-1" aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex h-10 items-center">
          <span className="grid h-10 w-10 shrink-0 place-items-center">
            <span className="h-4 w-4 animate-pulse rounded bg-surface-2" />
          </span>
          {expanded && <span className="h-3 flex-1 animate-pulse rounded bg-surface-2" />}
        </div>
      ))}
    </div>
  );
}

// A not-yet-built admin section: shown in the rail so the admin surface is
// visible as a roadmap, but muted and unclickable until its route ships (flip
// `ready` in ADMIN_SECTIONS). Collapses to just the icon like a real NavLink.
function SoonNavItem({
  label,
  icon,
  expanded,
}: {
  label: string;
  icon: IconName;
  expanded: boolean;
}) {
  return (
    <div
      title={expanded ? "Coming soon" : `${label} — coming soon`}
      className="flex h-10 cursor-not-allowed items-center rounded-input text-faint"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center">
        <Icon name={icon} size={18} />
      </span>
      <RevealLabel show={expanded} className="flex flex-1 items-center gap-2">
        <span className="flex-1">{label}</span>
        <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-muted">
          soon
        </span>
      </RevealLabel>
    </div>
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
