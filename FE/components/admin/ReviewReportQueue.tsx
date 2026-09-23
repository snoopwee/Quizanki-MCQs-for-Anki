"use client";

import Link from "next/link";
import { useState } from "react";
import {
  useAdminReviewReports,
  useTakeDownRating,
  useUpdateReviewReport,
} from "@/hooks/useReports";
import { buttonClasses } from "@/components/ui/Button";
import { timeAgo } from "@/lib/relativeTime";
import { Icon } from "@/components/ui/icons";

// Reported rating notes. A row shows the text as it was when reported — the author can delete a
// note the moment after reporting it, and an admin would otherwise be judging an empty report.
// The row names the writer (admin-only — the author's feedback page stays anonymous) because
// judging a note abusive was otherwise a dead end: the ban flow lives in Users and needs an id.
// The identity is a snapshot taken at report time, since an admin takedown deletes the rating.
//
// Taking a rating down removes the STARS as well as the note. The note is private and the star is
// public, so clearing only the text would leave the abuser's mark on the deck's score. The reason
// box below each report is what an admin weighs before doing it — including whether the author is
// simply trying to shed a bad rating.
export function ReviewReportQueue({ status }: { status: "open" | "" }) {
  const reports = useAdminReviewReports(status);
  const update = useUpdateReviewReport();
  const takeDown = useTakeDownRating();
  // Deleting someone's rating cannot be undone, so it asks first — unlike resolve/dismiss, which
  // only move a status.
  const [confirming, setConfirming] = useState<string | null>(null);

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
                {!r.ratingStillThere && (
                  <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[0.6875rem] font-semibold text-muted">
                    rating already gone
                  </span>
                )}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                <span>reported {timeAgo(r.createdAt)}</span>
                {r.writerId && (
                  <>
                    <span aria-hidden>·</span>
                    {/* Admin-only. The id is the part that identifies the account — it's what the
                        Users screen takes — so it's shown even when a name resolved. */}
                    <span>
                      written by{" "}
                      <span className="font-medium text-ink">{r.writerName ?? "unknown name"}</span>{" "}
                      <code className="select-all font-mono text-[0.6875rem] text-faint">
                        {r.writerId}
                      </code>
                    </span>
                  </>
                )}
              </p>

              {/* The snapshot, not the live note — that is the thing being judged. */}
              <blockquote className="mt-2 whitespace-pre-wrap break-words rounded-input border border-line bg-surface-2 px-3 py-2 text-sm text-ink">
                {r.noteSnapshot}
              </blockquote>

              {r.details && <p className="mt-2 text-sm text-muted">{r.details}</p>}

              {confirming === r.id && (
                <div className="mt-2 space-y-1.5 rounded-input border border-danger/30 bg-danger/5 p-2.5">
                  <p className="text-xs font-semibold text-ink">
                    Remove this rating from the deck?
                  </p>
                  <p className="text-xs text-muted">
                    The stars go too, and the deck&apos;s public score is recalculated without them.
                    This can&apos;t be undone.
                  </p>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setConfirming(null)}
                      className={buttonClasses({ variant: "ghost", size: "sm" })}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        takeDown.mutate(r.id, { onSuccess: () => setConfirming(null) })
                      }
                      disabled={takeDown.isPending}
                      className={buttonClasses({ variant: "danger", size: "sm" })}
                    >
                      Remove rating
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {r.writerId && (
                <Link
                  href="/admin/users"
                  className="inline-flex items-center gap-1.5 rounded-input border border-line-strong bg-surface px-2.5 py-1.5 text-sm font-medium text-muted transition hover:border-accent hover:text-accent"
                >
                  <Icon name="user" size={14} /> Users
                </Link>
              )}
              {r.deckName && (
                <Link
                  href={`/decks/${r.deckId}`}
                  className="inline-flex items-center gap-1.5 rounded-input border border-line-strong bg-surface px-2.5 py-1.5 text-sm font-medium text-muted transition hover:border-accent hover:text-accent"
                >
                  <Icon name="eye" size={14} /> Deck
                </Link>
              )}
              {r.ratingStillThere && (
                <button
                  type="button"
                  onClick={() => setConfirming(r.id)}
                  disabled={takeDown.isPending}
                  className="rounded-input border border-danger/40 bg-surface px-2.5 py-1.5 text-sm font-medium text-danger transition hover:bg-danger/10 disabled:opacity-50"
                >
                  Take rating down
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
