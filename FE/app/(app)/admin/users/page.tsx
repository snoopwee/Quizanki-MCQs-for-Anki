"use client";

import { useState } from "react";
import { useAdminUsers, useSetUserBanned } from "@/hooks/useAdmin";
import { useMe } from "@/hooks/useMe";
import type { AdminUser } from "@/types/api";
import { timeAgo } from "@/lib/relativeTime";
import { Modal } from "@/components/shared/Modal";
import { Spinner } from "@/components/ui/Spinner";

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
          Everyone with an account. Ban to block sign-in (reversible); accounts are managed in Supabase.
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
                      <span className="rounded-full bg-danger/10 px-2 py-0.5 text-[11px] font-semibold text-danger">
                        Banned
                      </span>
                    )}
                    {isSelf && (
                      <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent-ink">
                        You
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    {u.email}
                    {u.createdAt && <> · joined {timeAgo(u.createdAt)}</>}
                    {u.lastSignInAt && <> · last seen {timeAgo(u.lastSignInAt)}</>}
                  </p>
                </div>
                <div className="shrink-0">
                  {u.banned ? (
                    <button
                      type="button"
                      onClick={() => setBanned.mutate({ userId: u.id, banned: false })}
                      disabled={setBanned.isPending}
                      className="rounded-input border border-line-strong bg-surface px-2.5 py-1.5 text-sm font-medium text-muted transition hover:border-accent hover:text-accent disabled:opacity-50"
                    >
                      Unban
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setToBan(u)}
                      disabled={isSelf}
                      title={isSelf ? "You can't ban your own account" : undefined}
                      className="rounded-input border border-line-strong bg-surface px-2.5 py-1.5 text-sm font-medium text-muted transition hover:border-danger hover:text-danger disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Ban
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
        <Modal title="Ban this user?" onClose={setBanned.isPending ? () => {} : () => setToBan(null)}>
          <p className="text-sm text-muted">
            <span className="font-medium text-ink">{toBan.displayName || toBan.email}</span> won&apos;t be
            able to sign in until you unban them. Their decks and data are untouched.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setToBan(null)}
              disabled={setBanned.isPending}
              className="rounded-input border border-line-strong bg-surface px-4 py-2 text-sm font-medium text-muted transition hover:text-ink disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() =>
                setBanned.mutate(
                  { userId: toBan.id, banned: true },
                  { onSuccess: () => setToBan(null) },
                )
              }
              disabled={setBanned.isPending}
              className="inline-flex items-center gap-2 rounded-input bg-danger px-4 py-2 text-sm font-semibold text-white shadow-btn transition hover:opacity-95 disabled:opacity-60"
            >
              {setBanned.isPending && <Spinner className="h-4 w-4" />}
              Ban user
            </button>
          </div>
        </Modal>
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
