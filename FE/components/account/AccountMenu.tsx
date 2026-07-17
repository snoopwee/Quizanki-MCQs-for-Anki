"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/hooks/useSession";
import { createClient } from "@/lib/supabase/client";
import { Icon, type IconName } from "@/components/ui/icons";
import { Avatar } from "@/components/ui/Avatar";
import { avatarUrlOf, displayNameOf, initialsFrom } from "@/lib/userDisplay";

// The sidebar's bottom account control: an avatar + name row that opens an upward
// popover combining Profile, Settings, and Sign out (more items to come). Closes
// on outside click / Escape / after a choice — same pattern as KebabMenu. In the
// collapsed rail it shrinks to the avatar alone; the popover still opens.
export function AccountMenu({
  email,
  collapsed = false,
  side = "top",
  onNavigate,
  onOpenChange,
}: {
  email: string;
  collapsed?: boolean;
  // Where the popover flies out: "right" (beside the desktop rail) or "top"
  // (above, used in the mobile drawer where a right flyout would run off-screen).
  side?: "top" | "right";
  // Fires when a menu item navigates — lets the mobile drawer close itself.
  onNavigate?: () => void;
  // Lets the shell keep the rail expanded while the menu is open.
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const name = displayNameOf(user) || email || "Account";
  const avatar = initialsFrom(displayNameOf(user), email);
  const avatarUrl = avatarUrlOf(user);

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    onNavigate?.();
  };

  async function signOut() {
    close();
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label="Account menu"
        title={collapsed ? name : undefined}
        onClick={() => setOpen((o) => !o)}
        className={`flex h-12 w-full items-center rounded-input border border-transparent transition hover:bg-surface-2 ${
          open ? "bg-surface-2" : ""
        }`}
      >
        {/* Avatar sits in the same 40px column as the nav icons so it centres in
            the slim rail and never shifts on expand. */}
        <span className="grid h-10 w-10 shrink-0 place-items-center">
          <Avatar url={avatarUrl} initials={avatar} className="h-8 w-8 text-xs" />
        </span>
        {/* Name/email grow out with the rail (max-width + opacity) so nothing pops. */}
        <span
          className={`flex min-w-0 flex-col overflow-hidden text-left transition-all duration-200 ease-out ${
            collapsed ? "ml-0 max-w-0 opacity-0" : "ml-1 max-w-[10rem] opacity-100"
          }`}
        >
          <span className="truncate text-sm font-semibold text-ink">{name}</span>
          <span className="truncate font-mono text-[11px] text-faint">{email}</span>
        </span>
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          className={`absolute z-50 min-w-52 overflow-hidden rounded-input border border-line bg-surface py-1 shadow-card ${
            side === "right" ? "bottom-0 left-full ml-5" : "bottom-full left-0 mb-2"
          }`}
        >
          <MenuItemLink icon="user" label="Profile" href="/profile" onSelect={close} />
          <MenuItemLink icon="settings" label="Settings" href="/settings" onSelect={close} />
          <div className="my-1 border-t border-line" />
          <button
            type="button"
            role="menuitem"
            onClick={signOut}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-ink transition hover:bg-surface-2"
          >
            <Icon name="signOut" size={16} className="text-muted" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function MenuItemLink({
  icon,
  label,
  href,
  onSelect,
}: {
  icon: IconName;
  label: string;
  href: string;
  onSelect: () => void;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onSelect}
      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-ink transition hover:bg-surface-2"
    >
      <Icon name={icon} size={16} className="text-muted" />
      {label}
    </Link>
  );
}
