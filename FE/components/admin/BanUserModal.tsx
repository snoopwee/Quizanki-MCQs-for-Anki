"use client";

import { useState } from "react";
import { Modal } from "@/components/shared/Modal";
import { Icon } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/Spinner";
import { buttonClasses } from "@/components/ui/Button";
import { RESTORE_TEMPLATES, SUSPEND_TEMPLATES } from "@/lib/reportReasons";
import type { AdminUser } from "@/types/api";

/**
 * Suspend an account, or restore one — with the reason why.
 *
 * Suspending REQUIRES a reason, and the person suspended reads it verbatim on their next visit.
 * That is the whole point of suspensions living in our database rather than at Supabase: their ban
 * blocks sign-in, which would leave the reason undeliverable.
 *
 * Restoring takes an optional note, which becomes the message in their "account restored"
 * notification — so the round trip has an answer at both ends.
 */
export function BanUserModal({
  user,
  pending,
  error,
  onConfirm,
  onClose,
}: {
  user: AdminUser;
  pending: boolean;
  error?: string | null;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const restoring = user.banned;
  const [reason, setReason] = useState("");
  const who = user.displayName || user.email || "this account";
  // Only suspending demands one. Restoring is good news and needs no justification.
  const ready = restoring || reason.trim().length > 0;

  return (
    <Modal
      title={restoring ? "Restore this account?" : "Suspend this account?"}
      onClose={pending ? () => {} : onClose}
    >
      <p className="text-sm text-muted">
        <span className="font-medium text-ink">{who}</span>{" "}
        {restoring
          ? "will be able to use Quizanki again, and will be told."
          : "will be signed out of everything they try to do. Their decks and data are untouched."}
      </p>

      {restoring && user.banReason && (
        <div className="mt-3 rounded-input border border-line bg-surface-2 px-3 py-2">
          <p className="text-xs font-semibold text-muted">Suspended for</p>
          <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-ink">{user.banReason}</p>
        </div>
      )}

      <div className="mt-4 space-y-1.5">
        <label htmlFor="ban-reason" className="flex items-center gap-1.5 text-xs text-muted">
          <Icon name={restoring ? "check" : "alertTriangle"} size={13} className="shrink-0" />
          {restoring
            ? "Optional — sent to them as the restoration message."
            : "Shown to the person suspended — write it for them to read."}
        </label>
        <textarea
          id="ban-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={1000}
          rows={3}
          autoFocus
          placeholder={restoring ? "Anything to add?" : "Why are you suspending this account?"}
          className="focus-ring w-full resize-y rounded-input border border-line-strong bg-surface-2 px-3 py-2 text-sm text-ink outline-none placeholder:text-faint"
        />
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {(restoring ? RESTORE_TEMPLATES : SUSPEND_TEMPLATES).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setReason(t)}
            className="focus-ring rounded-full border border-line px-2.5 py-1 text-left text-xs text-muted transition hover:border-accent hover:text-accent"
          >
            {t}
          </button>
        ))}
      </div>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className={buttonClasses({ variant: "ghost" })}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onConfirm(reason.trim())}
          disabled={!ready || pending}
          className={buttonClasses({ variant: restoring ? "primary" : "danger" })}
        >
          {pending && (
            <Spinner
              className={`h-4 w-4 ${restoring ? "text-white" : "text-danger"}`}
              label="Saving"
            />
          )}
          {restoring ? "Restore account" : "Suspend account"}
        </button>
      </div>
    </Modal>
  );
}
