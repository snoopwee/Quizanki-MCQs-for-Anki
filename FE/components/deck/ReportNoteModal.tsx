"use client";

import { useId, useState } from "react";
import { Modal } from "@/components/shared/Modal";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { buttonClasses } from "@/components/ui/Button";
import { useReportNote } from "@/hooks/useDeckRating";
import { NOTE_REPORT_REASONS as REASONS } from "@/lib/reportReasons";


const fieldClasses =
  "focus-ring w-full rounded-input border border-line-strong bg-surface-2 px-3 py-2 text-sm text-ink outline-none placeholder:text-faint";

// Escalate one note to an admin. Separate from deleting it: deleting is "I don't want to read
// this", reporting is "somebody should deal with the person who wrote it".
export function ReportNoteModal({
  deckId,
  noteId,
  noteText,
  onClose,
}: {
  deckId: string;
  noteId: string;
  noteText: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<string>(REASONS[0]);
  const [details, setDetails] = useState("");
  const [done, setDone] = useState(false);
  const report = useReportNote(deckId);
  const reasonLabelId = useId();

  return (
    <Modal title={done ? "Report sent" : "Report this note"} onClose={onClose}>
      {done ? (
        <>
          <p className="text-sm text-muted">
            Thanks — an admin will look at it. You&apos;ll get a notification when they have.
          </p>
          <p className="mt-2 text-sm text-muted">
            You can still delete the note yourself in the meantime — the report keeps its own copy
            of the text, so it can still be judged.
          </p>
          <div className="mt-5 flex justify-end">
            <button type="button" onClick={onClose} className={buttonClasses({ variant: "primary" })}>
              Done
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-muted">
            For a note that&apos;s abusive rather than just unwelcome. Say why below — an admin
            reads it, and if they agree they&apos;ll remove the whole rating, stars included.
          </p>

          <blockquote className="mt-3 max-h-32 overflow-y-auto whitespace-pre-wrap break-words rounded-input border border-line bg-surface-2 px-3 py-2 text-sm text-ink">
            {noteText}
          </blockquote>

          <div className="mt-4 space-y-3">
            <div className="space-y-1">
              <span id={reasonLabelId} className="block text-xs font-medium text-muted">
                Reason
              </span>
              <Select
                value={reason}
                options={REASONS.map((r) => ({ value: r, label: r }))}
                onChange={setReason}
                ariaLabelledBy={reasonLabelId}
                fullWidth
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="report-note-details" className="block text-xs font-medium text-muted">
                Anything to add <span className="text-faint">(optional)</span>
              </label>
              <textarea
                id="report-note-details"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Context an admin would need…"
                className={`${fieldClasses} resize-y`}
              />
            </div>
          </div>

          {report.isError && (
            <p className="mt-3 text-sm text-danger">Couldn&apos;t send that report. Try again.</p>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={onClose} className={buttonClasses({ variant: "ghost" })}>
              Cancel
            </button>
            <button
              type="button"
              onClick={() =>
                report.mutate({ noteId, reason, details }, { onSuccess: () => setDone(true) })
              }
              disabled={report.isPending}
              className={buttonClasses({ variant: "primary" })}
            >
              {report.isPending && <Spinner className="h-4 w-4 text-white" label="Sending" />}
              Report
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
