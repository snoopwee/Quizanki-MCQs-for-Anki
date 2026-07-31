"use client";

import { useState } from "react";
import { Modal } from "@/components/shared/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { useReportDeck } from "@/hooks/useReports";

const REASONS = ["Spam", "Inappropriate", "Copyright", "Wrong or misleading", "Other"];

const fieldClasses =
  "focus-ring w-full rounded-input border border-line-strong bg-surface-2 px-3 py-2 text-sm text-ink outline-none placeholder:text-faint";

// Report a public deck for admin review. Kept lightweight — a reason category and
// optional details. On success it flips to a thank-you so the user knows it landed.
export function ReportDeckModal({
  deckId,
  deckName,
  onClose,
}: {
  deckId: string;
  deckName: string | null;
  onClose: () => void;
}) {
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState("");
  const [done, setDone] = useState(false);
  const report = useReportDeck(deckId);

  function submit() {
    report.mutate({ reason, details }, { onSuccess: () => setDone(true) });
  }

  return (
    <Modal title={done ? "Report received" : "Report deck"} onClose={onClose}>
      {done ? (
        <>
          <p className="text-sm text-muted">
            Thanks — an admin will review{" "}
            <span className="font-medium text-ink">{deckName || "this deck"}</span>.
          </p>
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="focus-ring rounded-input bg-accent px-4 py-2 text-sm font-semibold text-white shadow-btn transition hover:opacity-95"
            >
              Done
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-muted">
            Tell us what&apos;s wrong with{" "}
            <span className="font-medium text-ink">{deckName || "this deck"}</span>. Reports are private
            and reviewed by an admin.
          </p>
          <div className="mt-4 space-y-3">
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted">Reason</span>
              <select value={reason} onChange={(e) => setReason(e.target.value)} className={fieldClasses}>
                {REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted">Details (optional)</span>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                maxLength={1000}
                rows={3}
                placeholder="Anything that helps us review it…"
                className={fieldClasses}
              />
            </label>
          </div>

          {report.isError && (
            <p className="mt-3 rounded-input bg-danger/10 px-3 py-2 text-sm text-danger">
              Couldn&apos;t send the report. Try again.
            </p>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={report.isPending}
              className="rounded-input border border-line-strong bg-surface px-4 py-2 text-sm font-medium text-muted transition hover:text-ink disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={report.isPending}
              className="focus-ring inline-flex items-center gap-2 rounded-input bg-accent px-4 py-2 text-sm font-semibold text-white shadow-btn transition hover:opacity-95 disabled:opacity-60"
            >
              {report.isPending && <Spinner className="h-4 w-4" />}
              Submit report
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
