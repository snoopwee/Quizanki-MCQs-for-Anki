"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  useAdminReports,
  useReportCounts,
  useUpdateReport,
} from "@/hooks/useReports";
import { timeAgo } from "@/lib/relativeTime";
import { Segmented } from "@/components/ui/controls";
import { Select } from "@/components/ui/Select";
import { ReviewReportQueue } from "@/components/admin/ReviewReportQueue";
import { ReportActionModal, type ReportAction } from "@/components/admin/ReportActionModal";
import { ReportDetailModal, ReportRow } from "@/components/admin/ReportDetailModal";
import { reasonsFor } from "@/lib/reportReasons";
import { Icon } from "@/components/ui/icons";
import type { AdminReport } from "@/types/api";

type Queue = "decks" | "notes";
type Filter = "open" | "closed" | "";

// The moderation queue. Two queues, not one list: a deck report is about something public anyone
// can go and look at, a note report is about text one person was shown. Different rows, different
// actions — so separate tabs rather than a `type` column to squint at.
export default function AdminReportsPage() {
  const router = useRouter();
  const params = useSearchParams();

  // Every selection lives in the URL, not in useState. An admin opens a reported deck or a
  // reporter's profile and presses Back — with component state that returns them to the Decks tab,
  // losing the queue they were working. The URL survives the round trip, and it makes a
  // half-triaged queue a link somebody can send.
  const queue: Queue = params.get("queue") === "notes" ? "notes" : "decks";
  const filterParam = params.get("status");
  const filter: Filter =
    filterParam === "closed" ? "closed" : filterParam === "all" ? "" : "open";
  const reason = params.get("reason") ?? "";

  function select(next: { queue?: Queue; filter?: Filter; reason?: string }) {
    const q = new URLSearchParams(params.toString());
    if (next.queue) {
      q.set("queue", next.queue);
      // The two queues have different vocabularies, so a reason carried across would match
      // nothing and read as an empty queue.
      q.delete("reason");
    }
    if (next.filter !== undefined) q.set("status", next.filter === "" ? "all" : next.filter);
    if (next.reason !== undefined) {
      if (next.reason) q.set("reason", next.reason);
      else q.delete("reason");
    }
    router.replace(`?${q.toString()}`, { scroll: false });
  }

  const reports = useAdminReports(filter, reason);
  const counts = useReportCounts(true);
  const update = useUpdateReport();

  const [open, setOpen] = useState<AdminReport | null>(null);
  const [action, setAction] = useState<ReportAction | null>(null);

  const rows = reports.data ?? [];

  function confirm(note: string) {
    if (!open || !action || action === "takedown") return;
    update.mutate(
      { reportId: open.id, status: action, note },
      {
        onSuccess: () => {
          setAction(null);
          setOpen(null);
        },
      },
    );
  }

  return (
    <div className="space-y-5">
      <header className="space-y-3">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight text-ink">Reports</h1>
          <p className="mt-1 text-sm text-muted">
            {queue === "decks"
              ? "Decks users have flagged for review."
              : "Notes authors have escalated from their feedback page."}
          </p>
        </div>

        {/* Two buttons, not a switch: each carries its own outstanding count, and a segmented
            control can only badge the half you are already looking at. */}
        <div className="flex flex-wrap items-center gap-2">
          <QueueButton
            active={queue === "decks"}
            label="Decks"
            count={counts.data?.deckReports}
            onClick={() => select({ queue: "decks" })}
          />
          <QueueButton
            active={queue === "notes"}
            label="Notes"
            count={counts.data?.noteReports}
            onClick={() => select({ queue: "notes" })}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            options={[
              { value: "open", label: "Open" },
              { value: "closed", label: "Closed" },
              { value: "", label: "All" },
            ]}
            value={filter}
            onChange={(v) => select({ filter: v as Filter })}
          />
          <Select
            value={reason}
            onChange={(v) => select({ reason: v })}
            options={[
              { value: "", label: "All reasons" },
              ...reasonsFor(queue).map((r) => ({ value: r, label: r })),
            ]}
          />
        </div>
      </header>

      {queue === "notes" && <ReviewReportQueue status={filter} reason={reason} />}

      {queue === "decks" &&
        (reports.isLoading ? (
          <SkeletonList />
        ) : reports.isError ? (
          <p className="rounded-card border border-danger/30 bg-danger/10 px-4 py-6 text-center text-sm text-danger">
            Couldn&apos;t load reports. Try again.
          </p>
        ) : rows.length === 0 ? (
          <p className="rounded-card border border-dashed border-line-strong px-4 py-10 text-center text-sm text-muted">
            {filter === "open"
              ? "No open reports — all clear."
              : filter === "closed"
                ? "Nothing closed yet."
                : "No reports yet."}
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <ReportRow
                key={r.id}
                title={r.deckName ?? "(deck deleted)"}
                reason={r.reason}
                status={r.status}
                meta={`${r.authorName ? `by ${r.authorName} · ` : ""}reported ${timeAgo(r.createdAt)}`}
                onOpen={() => setOpen(r)}
              />
            ))}
          </ul>
        ))}

      {/* Detail and the reason form never stack — picking an action replaces the detail. */}
      {open && !action && (
        <ReportDetailModal
          title={open.deckName ?? "(deck deleted)"}
          fields={[
            { label: "Reason", value: open.reason },
            { label: "Author", value: open.authorName },
            { label: "Reported", value: timeAgo(open.createdAt) },
            { label: "Details", value: open.details },
          ]}
          status={open.status}
          resolutionNote={open.resolutionNote}
          onAction={setAction}
          onClose={() => setOpen(null)}
          footer={
            open.deckName ? (
              <Link
                href={`/decks/${open.deckId}`}
                className="inline-flex items-center gap-1.5 rounded-input border border-line-strong bg-surface px-2.5 py-1.5 text-sm font-medium text-muted transition hover:border-accent hover:text-accent"
              >
                <Icon name="eye" size={14} /> View deck
              </Link>
            ) : null
          }
        />
      )}

      {open && action && (
        <ReportActionModal
          action={action}
          subject={open.deckName ?? "(deck deleted)"}
          pending={update.isPending}
          error={update.isError ? "Couldn't save that. Try again." : null}
          onConfirm={confirm}
          onClose={() => setAction(null)}
        />
      )}
    </div>
  );
}

/** A queue tab with its own outstanding count — red, because it is work nobody has done. */
function QueueButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number | undefined;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`focus-ring inline-flex items-center gap-2 rounded-input border px-3.5 py-2 text-sm font-medium transition ${
        active
          ? "border-accent bg-accent-soft text-accent-ink"
          : "border-line bg-surface text-muted hover:border-line-strong hover:text-ink"
      }`}
    >
      {label}
      {/* Left off entirely while unknown: a zero that is really "not loaded yet" is worse than
          no number at all. */}
      {count ? (
        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-danger px-1.5 py-0.5 text-[0.6875rem] font-semibold leading-none text-white">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </button>
  );
}

function SkeletonList() {
  return (
    <ul className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <li key={i} className="rounded-card border border-line bg-surface p-4">
          <div className="h-4 w-1/3 animate-pulse rounded bg-surface-2" />
          <div className="mt-2 h-3 w-1/4 animate-pulse rounded bg-surface-2" />
        </li>
      ))}
    </ul>
  );
}
