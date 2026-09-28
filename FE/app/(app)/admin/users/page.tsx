"use client";

import { useState } from "react";
import { useAdminUsers, useSetUserBanned } from "@/hooks/useAdmin";
import { BanUserModal } from "@/components/admin/BanUserModal";
import { useMe } from "@/hooks/useMe";
import type { AdminUser } from "@/types/api";
import { timeAgo } from "@/lib/relativeTime";

// Manage users, backed live by the Supabase Admin API (no user table). Ban disables
// sign-in; it's reversible (Unban). You can't ban your own account.
export default function AdminUsersPage() {
  const [page, setPage] = useState(1); // GoTrue is 1-based
  const users = useAdminUsers(page);
  const me = useMe();
  const setBanned = useSetUserBanned();
  const [toBan, setToBan] = useState<AdminUser | null>(null);

  const data = users.data;
  const rows = data?.users ?? [];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-xl font-bold tracking-tight text-ink">Users</h1>
        <p className="mt-1 text-sm text-muted">
          Everyone with an account. Suspending is reversible, and the reason you give is shown to
          the person suspended.
        </p>
      </header>

      {users.isLoading ? (
        <SkeletonList />
      ) : users.isError ? (
        <p className="rounded-card border border-danger/30 bg-danger/10 px-4 py-6 text-center text-sm text-danger">
          Couldn&apos;t load users. The server may not have a Supabase service key configured.
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-card border border-dashed border-line-strong px-4 py-10 text-center text-sm text-muted">
          No users on this page.
        </p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
          {rows.map((u) => {
            const isSelf = u.id === me.data?.userId;
            return (
              <li key={u.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate font-medium text-ink">
                    {u.displayName || u.email || "Unknown"}
                    {u.banned && (
                      <span className="rounded-full bg-danger/10 px-2 py-0.5 text-[0.6875rem] font-semibold text-danger">
                        Suspended
                      </span>
                    )}
                    {isSelf && (
                      <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[0.6875rem] font-semibold text-accent-ink">
                        You
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    {u.email}
                    {u.createdAt && <> · joined {timeAgo(u.createdAt)}</>}
                    {u.lastSignInAt && <> · last seen {timeAgo(u.lastSignInAt)}</>}
                  </p>
                  {/* The standing reason, in the list: an admin reviewing suspensions shouldn't
                      have to open anything to see why each one happened. */}
                  {u.banned && u.banReason && (
                    <p className="mt-1 truncate text-xs text-danger" title={u.banReason}>
                      {u.banReason}
                    </p>
                  )}
                </div>
                <div className="shrink-0">
                  {u.banned ? (
                    <button
                      type="button"
                      onClick={() => setToBan(u)}
                      disabled={setBanned.isPending}
                      className="rounded-input border border-line-strong bg-surface px-2.5 py-1.5 text-sm font-medium text-muted transition hover:border-accent hover:text-accent disabled:opacity-50"
                    >
                      Restore
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setToBan(u)}
                      disabled={isSelf}
                      title={isSelf ? "You can't suspend your own account" : undefined}
                      className="rounded-input border border-line-strong bg-surface px-2.5 py-1.5 text-sm font-medium text-muted transition hover:border-danger hover:text-danger disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Suspend
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {data && (page > 1 || data.hasMore) && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-input border border-line-strong bg-surface px-3 py-1.5 font-medium text-muted transition hover:text-ink disabled:opacity-40"
          >
            Prev
          </button>
          <span className="font-mono text-xs text-muted">Page {page}</span>
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            disabled={!data.hasMore}
            className="rounded-input border border-line-strong bg-surface px-3 py-1.5 font-medium text-muted transition hover:text-ink disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

      {toBan && (
        <BanUserModal
          user={toBan}
          pending={setBanned.isPending}
          error={setBanned.isError ? "Couldn't save that. Try again." : null}
          onConfirm={(reason) =>
            setBanned.mutate(
              { userId: toBan.id, banned: !toBan.banned, reason },
              { onSuccess: () => setToBan(null) },
            )
          }
          onClose={() => setToBan(null)}
        />
      )}

    </div>
  );
}

function SkeletonList() {
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
      {Array.from({ length: 8 }).map((_, i) => (
        <li key={i} className="flex items-center gap-4 p-4">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-1/3 animate-pulse rounded bg-surface-2" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-surface-2" />
          </div>
          <div className="h-8 w-16 animate-pulse rounded bg-surface-2" />
        </li>
      ))}
    </ul>
  );
}
