"use client";

import Link from "next/link";
import { useState } from "react";
import {
  useAdminReviewReports,
  useTakeDownRating,
  useUpdateReviewReport,
} from "@/hooks/useReports";
import { timeAgo } from "@/lib/relativeTime";
import { Icon } from "@/components/ui/icons";
import { ReportActionModal, type ReportAction } from "@/components/admin/ReportActionModal";
import { ReportDetailModal, ReportRow } from "@/components/admin/ReportDetailModal";
import type { AdminReviewReport } from "@/types/api";

// Reported rating notes. A report is opened, not scanned: the row is the deck name and the
// reporter's reason, and everything that matters — the quoted text, who wrote it, the details —
// lives in the detail modal, one report at a time.
//
// The text is the snapshot taken when it was reported. The author can delete a note the moment
// after reporting it, and an admin would otherwise be judging an empty report. The writer is named
// too (admin-only — the author's own feedback page stays anonymous) because judging a note abusive
// was otherwise a dead end: the ban flow lives in Users and needs an id.
//
// Taking a rating down removes the STARS as well as the note. The note is private and the star is
// public, so clearing only the text would leave the abuser's mark on the deck's score.
export function ReviewReportQueue({
  status,
  reason,
}: {
  status: "open" | "closed" | "";
  reason: string;
}) {
  const reports = useAdminReviewReports(status, reason);
  const update = useUpdateReviewReport();
  const takeDown = useTakeDownRating();

  const [open, setOpen] = useState<AdminReviewReport | null>(null);
  const [action, setAction] = useState<ReportAction | null>(null);

  const rows = reports.data ?? [];
  const pending = update.isPending || takeDown.isPending;

  function confirm(note: string) {
    if (!open || !action) return;
    const done = {
      onSuccess: () => {
        setAction(null);
        setOpen(null);
      },
    };
    if (action === "takedown") {
      // The reason goes on to the person whose rating this is, which is why it is mandatory.
      takeDown.mutate({ reportId: open.id, note }, done);
    } else {
      update.mutate({ reportId: open.id, status: action, note }, done);
    }
  }

  if (reports.isLoading) {
    return (
      <ul className="space-y-2">
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

  return (
    <>
      {rows.length === 0 ? (
        <p className="rounded-card border border-dashed border-line-strong px-4 py-10 text-center text-sm text-muted">
          {status === "open"
            ? "No reported notes — all clear."
            : status === "closed"
              ? "Nothing closed yet."
              : "No notes have been reported yet."}
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <ReportRow
              key={r.id}
              title={r.deckName ?? "(deck deleted)"}
              reason={r.reason}
              status={r.status}
              meta={`${r.writerName ? `note by ${r.writerName} · ` : ""}reported ${timeAgo(r.createdAt)}`}
              onOpen={() => setOpen(r)}
            />
          ))}
        </ul>
      )}

      {open && !action && (
        <ReportDetailModal
          title={open.deckName ?? "(deck deleted)"}
          fields={[
            { label: "Reason", value: open.reason },
            { label: "Written by", value: open.writerName ?? open.writerId },
            { label: "Reported", value: timeAgo(open.createdAt) },
            { label: "Details", value: open.details },
          ]}
          quoted={open.noteSnapshot}
          status={open.status}
          resolutionNote={open.resolutionNote}
          // Only offered while there is still a rating there: the author may have cleared the note
          // already, and the star alone is still actionable — but a rating that is gone is gone.
          canTakeDown={open.ratingStillThere}
          onAction={setAction}
          onClose={() => setOpen(null)}
          footer={
            <>
              {open.writerId && (
                <Link
                  href="/admin/users"
                  className="inline-flex items-center gap-1.5 rounded-input border border-line-strong bg-surface px-2.5 py-1.5 text-sm font-medium text-muted transition hover:border-accent hover:text-accent"
                >
                  <Icon name="user" size={14} /> Users
                </Link>
              )}
              {open.deckName && (
                <Link
                  href={`/decks/${open.deckId}`}
                  className="inline-flex items-center gap-1.5 rounded-input border border-line-strong bg-surface px-2.5 py-1.5 text-sm font-medium text-muted transition hover:border-accent hover:text-accent"
                >
                  <Icon name="eye" size={14} /> Deck
                </Link>
              )}
            </>
          }
        />
      )}

      {open && action && (
        <ReportActionModal
          action={action}
          subject={open.noteSnapshot || open.deckName || "this report"}
          pending={pending}
          error={
            update.isError || takeDown.isError ? "Couldn't save that. Try again." : null
          }
          onConfirm={confirm}
          onClose={() => setAction(null)}
        />
      )}
    </>
  );
}
