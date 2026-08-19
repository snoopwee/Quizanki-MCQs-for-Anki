"use client";

import { useMe } from "@/hooks/useMe";
import { useAdminStats } from "@/hooks/useAdmin";
import { Icon, type IconName } from "@/components/ui/icons";

// Admin overview: the site at a glance. Read-only totals from our own tables — a
// true signup count needs the Supabase Admin API (no user table), so "users" is
// split into the two honest numbers we can measure: creators and learners.
type Tile = { label: string; value: number; icon: IconName; hint?: string };

export default function AdminOverviewPage() {
  const me = useMe();
  const stats = useAdminStats();
  const s = stats.data;

  const tiles: Tile[] = s
    ? [
        { label: "Decks", value: s.decks, icon: "layers" },
        { label: "Public decks", value: s.publicDecks, icon: "link", hint: "Shared to Discover" },
        { label: "Cards", value: s.notes, icon: "cards", hint: "Across all decks" },
        { label: "Study answers", value: s.answers, icon: "target", hint: "All time" },
        { label: "Creators", value: s.creators, icon: "user", hint: "Users with a deck" },
        { label: "Learners", value: s.learners, icon: "brain", hint: "Users who've studied" },
        { label: "New decks", value: s.decksLast30Days, icon: "upload", hint: "Last 30 days" },
        { label: "Answers", value: s.answersLast7Days, icon: "clock", hint: "Last 7 days" },
      ]
    : [];

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-input bg-accent-soft text-accent-ink">
          <Icon name="lock" size={18} />
        </span>
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight text-ink">Admin</h1>
          {me.data?.email && <p className="text-xs text-muted">Signed in as {me.data.email}</p>}
        </div>
      </header>

      <div>
        <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-[0.06em] text-muted">
          Site overview
        </p>

        {stats.isLoading ? (
          <SkeletonTiles />
        ) : stats.isError ? (
          <p className="rounded-card border border-danger/30 bg-danger/10 px-4 py-6 text-center text-sm text-danger">
            Couldn&apos;t load stats. Try again.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {tiles.map((t) => (
              <li key={t.label} className="rounded-card border border-line bg-surface p-4">
                <div className="flex items-center gap-2 text-muted">
                  <Icon name={t.icon} size={15} />
                  <span className="text-xs font-medium">{t.label}</span>
                </div>
                <p className="mt-2 font-display text-2xl font-bold tracking-tight text-ink">
                  {t.value.toLocaleString()}
                </p>
                {t.hint && <p className="mt-0.5 text-[0.6875rem] text-faint">{t.hint}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-faint">
        “Users” is shown as creators and learners — the totals we can measure from our own data. A full
        registered-user count arrives with the Users section.
      </p>
    </div>
  );
}

function SkeletonTiles() {
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <li key={i} className="rounded-card border border-line bg-surface p-4">
          <div className="h-3 w-16 animate-pulse rounded bg-surface-2" />
          <div className="mt-3 h-7 w-20 animate-pulse rounded bg-surface-2" />
        </li>
      ))}
    </ul>
  );
}
