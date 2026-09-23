"use client";

import Link from "next/link";
import {
  useAdminReviewReports,
  useDeleteReportedNote,
  useUpdateReviewReport,
} from "@/hooks/useReports";
import { timeAgo } from "@/lib/relativeTime";
import { Icon } from "@/components/ui/icons";

// Reported rating notes. A row shows the text as it was when reported — the author can delete a
// note the moment after reporting it, and an admin would otherwise be judging an empty report.
// There is no writer identity here on purpose: this queue judges text. Acting on the person goes
// through Users, which is the one moment identity is warranted.
export function ReviewReportQueue({ status }: { status: "open" | "" }) {
  const reports = useAdminReviewReports(status);
  const update = useUpdateReviewReport();
  const removeNote = useDeleteReportedNote();

  const rows = reports.data ?? [];

  if (reports.isLoading) {
    return (
      <ul className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <li key={i} className="rounded-card border border-line bg-surface p-4">
            <div className="h-4 w-1/3 animate-pulse rounded bg-surface-2" />
            <div className="mt-2 h-3 w-1/4 animate-pulse rounded bg-surface-2" />
          </li>
        ))}
      </ul>
    );
  }

  if (reports.isError) {
    return (
      <p className="rounded-card border border-danger/30 bg-danger/10 px-4 py-6 text-center text-sm text-danger">
        Couldn&apos;t load reported notes. Try again.
      </p>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-line-strong px-4 py-10 text-center text-sm text-muted">
        {status === "open" ? "No reported notes — all clear." : "No notes have been reported yet."}
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.id} className="rounded-card border border-line bg-surface p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
                <span className="truncate">{r.deckName ?? "(deck deleted)"}</span>
                {r.reason && (
                  <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[0.6875rem] font-semibold text-accent-ink">
                    {r.reason}
                  </span>
                )}
                {r.status !== "open" && (
                  <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[0.6875rem] font-semibold capitalize text-muted">
                    {r.status}
                  </span>
                )}
                {!r.noteStillThere && (
                  <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[0.6875rem] font-semibold text-muted">
                    note already gone
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-xs text-muted">reported {timeAgo(r.createdAt)}</p>

              {/* The snapshot, not the live note — that is the thing being judged. */}
              <blockquote className="mt-2 whitespace-pre-wrap break-words rounded-input border border-line bg-surface-2 px-3 py-2 text-sm text-ink">
                {r.noteSnapshot}
              </blockquote>

              {r.details && <p className="mt-2 text-sm text-muted">{r.details}</p>}
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {r.deckName && (
                <Link
                  href={`/decks/${r.deckId}`}
                  className="inline-flex items-center gap-1.5 rounded-input border border-line-strong bg-surface px-2.5 py-1.5 text-sm font-medium text-muted transition hover:border-accent hover:text-accent"
                >
                  <Icon name="eye" size={14} /> Deck
                </Link>
              )}
              {r.noteStillThere && (
                <button
                  type="button"
                  onClick={() => removeNote.mutate(r.id)}
                  disabled={removeNote.isPending}
                  className="rounded-input border border-danger/40 bg-surface px-2.5 py-1.5 text-sm font-medium text-danger transition hover:bg-danger/10 disabled:opacity-50"
                >
                  Take note down
                </button>
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
  );
}
