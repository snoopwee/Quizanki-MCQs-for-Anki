"use client";

import { useState } from "react";
import Link from "next/link";
import { useAdminReports, useUpdateReport } from "@/hooks/useReports";
import { timeAgo } from "@/lib/relativeTime";
import { Segmented } from "@/components/ui/controls";
import { Icon } from "@/components/ui/icons";

// The moderation queue. Open reports by default; resolve (handled) or dismiss (not a
// problem) closes them. Moderating the deck itself uses the Moderate decks page.
export default function AdminReportsPage() {
  const [filter, setFilter] = useState<"open" | "">("open"); // "" = all
  const reports = useAdminReports(filter);
  const update = useUpdateReport();

  const rows = reports.data ?? [];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight text-ink">Reports</h1>
          <p className="mt-1 text-sm text-muted">Decks users have flagged for review.</p>
        </div>
        <Segmented
          options={[
            { value: "open", label: "Open" },
            { value: "", label: "All" },
          ]}
          value={filter}
          onChange={(v) => setFilter(v as "open" | "")}
        />
      </header>

      {reports.isLoading ? (
        <SkeletonList />
      ) : reports.isError ? (
        <p className="rounded-card border border-danger/30 bg-danger/10 px-4 py-6 text-center text-sm text-danger">
          Couldn&apos;t load reports. Try again.
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-card border border-dashed border-line-strong px-4 py-10 text-center text-sm text-muted">
          {filter === "open" ? "No open reports — all clear." : "No reports yet."}
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="rounded-card border border-line bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-medium text-ink">
                    <span className="truncate">{r.deckName ?? "(deck deleted)"}</span>
                    {r.reason && (
                      <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent-ink">
                        {r.reason}
                      </span>
                    )}
                    {r.status !== "open" && (
                      <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold capitalize text-muted">
                        {r.status}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {r.authorName && <>by {r.authorName} · </>}
                    reported {timeAgo(r.createdAt)}
                  </p>
                  {r.details && <p className="mt-2 text-sm text-ink">{r.details}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {r.deckName && (
                    <Link
                      href={`/decks/${r.deckId}`}
                      className="inline-flex items-center gap-1.5 rounded-input border border-line-strong bg-surface px-2.5 py-1.5 text-sm font-medium text-muted transition hover:border-accent hover:text-accent"
                    >
                      <Icon name="eye" size={14} /> View
                    </Link>
                  )}
                  {r.status === "open" && (
                    <>
                      <button
                        type="button"
                        onClick={() => update.mutate({ reportId: r.id, status: "resolved" })}
                        disabled={update.isPending}
                        className="rounded-input border border-line-strong bg-surface px-2.5 py-1.5 text-sm font-medium text-muted transition hover:border-accent hover:text-accent disabled:opacity-50"
                      >
                        Resolve
                      </button>
                      <button
                        type="button"
                        onClick={() => update.mutate({ reportId: r.id, status: "dismissed" })}
                        disabled={update.isPending}
                        className="rounded-input border border-line-strong bg-surface px-2.5 py-1.5 text-sm font-medium text-muted transition hover:text-ink disabled:opacity-50"
                      >
                        Dismiss
                      </button>
                    </>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SkeletonList() {
  return (
    <ul className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <li key={i} className="rounded-card border border-line bg-surface p-4">
          <div className="h-4 w-1/3 animate-pulse rounded bg-surface-2" />
          <div className="mt-2 h-3 w-1/4 animate-pulse rounded bg-surface-2" />
        </li>
      ))}
    </ul>
  );
}
