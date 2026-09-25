"use client";

import { useState } from "react";
import { Modal } from "@/components/shared/Modal";
import { Icon } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/Spinner";
import { buttonClasses } from "@/components/ui/Button";
import {
  DISMISS_TEMPLATES,
  RESOLVE_TEMPLATES,
  TAKEDOWN_TEMPLATES,
} from "@/lib/reportReasons";

export type ReportAction = "resolved" | "dismissed" | "takedown";

const COPY: Record<
  ReportAction,
  { title: string; verb: string; templates: readonly string[]; audience: string; danger: boolean }
> = {
  resolved: {
    title: "Resolve this report",
    verb: "Resolve",
    templates: RESOLVE_TEMPLATES,
    audience: "Internal — only admins ever read this.",
    danger: false,
  },
  dismissed: {
    title: "Dismiss this report",
    verb: "Dismiss",
    templates: DISMISS_TEMPLATES,
    audience: "Internal — only admins ever read this.",
    danger: false,
  },
  takedown: {
    title: "Remove this rating",
    verb: "Remove rating",
    templates: TAKEDOWN_TEMPLATES,
    // The one reason with an audience outside this room, and the admin must know that before
    // they write it.
    audience: "Sent to the person whose rating this is — write it for them to read.",
    danger: true,
  },
};

/**
 * Confirm a moderation decision, with the reason why.
 *
 * The reason is mandatory, and that is the point of this modal existing at all: the report row is
 * deleted fifteen days after it closes (V37), so a decision made with one click leaves no record
 * of itself. Templates make the common case fast without stopping anybody writing something
 * specific — they fill the box, they do not replace it.
 */
export function ReportActionModal({
  action,
  subject,
  pending,
  error,
  onConfirm,
  onClose,
}: {
  action: ReportAction;
  /** What is being acted on, shown so an admin can't confirm the wrong row. */
  subject: string;
  pending: boolean;
  error?: string | null;
  onConfirm: (note: string) => void;
  onClose: () => void;
}) {
  const copy = COPY[action];
  const [note, setNote] = useState("");
  const ready = note.trim().length > 0;

  return (
    <Modal title={copy.title} onClose={onClose}>
      <p className="truncate text-sm text-muted" title={subject}>
        {subject}
      </p>

      <div className="mt-4 space-y-1.5">
        <label htmlFor="report-action-note" className="flex items-center gap-1.5 text-xs text-muted">
          <Icon name={copy.danger ? "alertTriangle" : "lock"} size={13} className="shrink-0" />
          {copy.audience}
        </label>
        <textarea
          id="report-action-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={1000}
          rows={3}
          autoFocus
          placeholder="Why are you doing this?"
          className="focus-ring w-full resize-y rounded-input border border-line-strong bg-surface-2 px-3 py-2 text-sm text-ink outline-none placeholder:text-faint"
        />
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {copy.templates.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setNote(t)}
            className="focus-ring rounded-full border border-line px-2.5 py-1 text-left text-xs text-muted transition hover:border-accent hover:text-accent"
          >
            {t}
          </button>
        ))}
      </div>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
        <button type="button" onClick={onClose} className={buttonClasses({ variant: "ghost" })}>
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onConfirm(note.trim())}
          disabled={!ready || pending}
          className={buttonClasses({
            variant: copy.danger ? "danger" : "primary",
          })}
        >
          {/* `danger` is an outline variant, so a white spinner would be invisible on it. */}
          {pending && (
            <Spinner
              className={`h-3.5 w-3.5 ${copy.danger ? "text-danger" : "text-white"}`}
              label="Working"
            />
          )}
          {copy.verb}
        </button>
      </div>
    </Modal>
  );
}
