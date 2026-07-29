"use client";

import { useMe } from "@/hooks/useMe";
import { Icon, type IconName } from "@/components/ui/icons";

// Admin overview. The landing page of the admin area — a map of what's here. The
// individual sections fill in over the next phases; for now this states the plan
// and confirms the area is reachable (which, if you can see it, means the backend
// recognised you as an admin — the page is behind the ROLE_ADMIN gate).
type Panel = { label: string; icon: IconName; blurb: string; status: string };

const PANELS: Panel[] = [
  { label: "Moderate decks", icon: "layers", status: "Live", blurb: "Review every public deck; unpublish or remove ones that shouldn't be shared." },
  { label: "Site stats", icon: "target", status: "Planned", blurb: "Totals at a glance — users, decks, public decks, imports." },
  { label: "Users", icon: "user", status: "Planned", blurb: "List users and disable/ban, via the Supabase Admin API." },
  { label: "Reports", icon: "clipboard", status: "Planned", blurb: "A moderation queue of decks users have reported." },
  { label: "Site config", icon: "settings", status: "Planned", blurb: "Live settings — feature flags, a banner, and maintenance mode." },
];

export default function AdminOverviewPage() {
  const me = useMe();
  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-input bg-accent-soft text-accent-ink">
          <Icon name="lock" size={18} />
        </span>
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight text-ink">Admin</h1>
          {me.data?.email && <p className="text-xs text-muted">Signed in as {me.data.email}</p>}
        </div>
      </header>

      <div className="rounded-card border border-line bg-surface p-5">
        <p className="text-sm text-ink">
          Welcome to the admin area. You&apos;re here because your account is on the admin allowlist.
        </p>
        <p className="mt-1 text-xs text-muted">
          The sections below unlock as they&apos;re built. Everything here is enforced on the server —
          the tabs are just navigation.
        </p>
      </div>

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PANELS.map((p) => (
          <li key={p.label} className="rounded-card border border-line bg-surface p-5">
            <div className="flex items-center justify-between">
              <span className="grid h-9 w-9 place-items-center rounded-input bg-accent-soft text-accent-ink">
                <Icon name={p.icon} size={18} />
              </span>
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-muted">
                {p.status}
              </span>
            </div>
            <p className="mt-3 font-display text-base font-semibold text-ink">{p.label}</p>
            <p className="mt-1 text-sm text-muted">{p.blurb}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
