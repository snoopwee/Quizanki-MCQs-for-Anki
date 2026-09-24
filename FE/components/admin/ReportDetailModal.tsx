"use client";

import { Modal } from "@/components/shared/Modal";
import { Icon } from "@/components/ui/icons";
import { buttonClasses } from "@/components/ui/Button";
import type { ReportAction } from "@/components/admin/ReportActionModal";

export type DetailField = { label: string; value: string | null | undefined };

/**
 * One report, in full.
 *
 * The queue rows are titles only — a list where every row spells out its own reason, details and
 * quoted text is a wall nobody triages from. The detail lives here, one report at a time, with the
 * decision buttons attached to the thing being decided.
 *
 * Actions don't happen here: picking one hands back to the caller, which opens the reason form.
 * Sequential, never stacked — a modal on top of a modal buries the thing you are judging.
 */
export function ReportDetailModal({
  title,
  fields,
  quoted,
  status,
  resolutionNote,
  canTakeDown,
  onAction,
  onClose,
  footer,
}: {
  title: string;
  fields: DetailField[];
  /** The reported text itself, where there is one — quoted, scrollable, never truncated. */
  quoted?: string | null;
  status: string;
  resolutionNote?: string | null;
  /** Only the note queue can remove a rating; a deck is moderated on its own page. */
  canTakeDown?: boolean;
  onAction: (action: ReportAction) => void;
  onClose: () => void;
  /** Extra controls for this queue — "View deck", "Open the account", and so on. */
  footer?: React.ReactNode;
}) {
  const open = status === "open";

  return (
    <Modal title={title} onClose={onClose}>
      <dl className="space-y-2 text-sm">
        {fields
          .filter((f) => f.value)
          .map((f) => (
            <div key={f.label} className="flex flex-wrap gap-x-2">
              <dt className="shrink-0 text-muted">{f.label}</dt>
              <dd className="min-w-0 flex-1 break-words text-ink">{f.value}</dd>
            </div>
          ))}
      </dl>

      {quoted && (
        <blockquote className="mt-3 max-h-48 overflow-y-auto whitespace-pre-wrap break-words rounded-input border border-line bg-surface-2 px-3 py-2 text-sm text-ink">
          {quoted}
        </blockquote>
      )}

      {!open && (
        <div className="mt-4 rounded-input border border-line bg-surface-2 px-3 py-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold capitalize text-muted">
            <Icon name="check" size={13} /> {status}
          </p>
          {/* Why, from whoever closed it. Worth surfacing: the row is deleted fifteen days after
              this, so this modal is the only place the reasoning is ever read. */}
          <p className="mt-1 text-sm text-ink">
            {resolutionNote || <span className="text-faint">No reason was recorded.</span>}
          </p>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {footer}
        <span className="flex-1" />
        {open && (
          <>
            {canTakeDown && (
              <button
                type="button"
                onClick={() => onAction("takedown")}
                className={buttonClasses({ variant: "danger", size: "sm" })}
              >
                Remove rating
              </button>
            )}
            <button
              type="button"
              onClick={() => onAction("dismissed")}
              className={buttonClasses({ variant: "ghost", size: "sm" })}
            >
              Dismiss
            </button>
            <button
              type="button"
              onClick={() => onAction("resolved")}
              className={buttonClasses({ variant: "primary", size: "sm" })}
            >
              Resolve
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}

/** A queue row: the title, and just enough beside it to decide whether to open it. */
export function ReportRow({
  title,
  reason,
  status,
  meta,
  onOpen,
}: {
  title: string;
  reason?: string | null;
  status: string;
  meta: string;
  onOpen: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="focus-ring flex w-full items-center gap-3 rounded-card border border-line bg-surface p-4 text-left transition hover:border-line-strong"
      >
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate font-medium text-ink">{title}</span>
            {reason && (
              <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[0.6875rem] font-semibold text-accent-ink">
                {reason}
              </span>
            )}
            {status !== "open" && (
              <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[0.6875rem] font-semibold capitalize text-muted">
                {status}
              </span>
            )}
          </span>
          <span className="mt-0.5 block text-xs text-muted">{meta}</span>
        </span>
        <Icon name="chevronRight" size={15} className="shrink-0 text-faint" />
      </button>
    </li>
  );
}
