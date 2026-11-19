"use client";

import { useId, useState } from "react";
import { Modal } from "@/components/shared/Modal";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { useReportDeck } from "@/hooks/useReports";
import {
  DECK_REPORT_REASON_KEYS,
  DECK_REPORT_REASONS as REASONS,
} from "@/lib/reportReasons";
import { useT } from "@/components/i18n/LocaleProvider";


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
  const [reason, setReason] = useState<string>(REASONS[0]);
  const [details, setDetails] = useState("");
  const [done, setDone] = useState(false);
  const report = useReportDeck(deckId);
  const reasonLabelId = useId();
  const t = useT();

  function submit() {
    report.mutate({ reason, details }, { onSuccess: () => setDone(true) });
  }

  return (
    <Modal title={done ? t("report.received") : t("report.deck")} onClose={onClose}>
      {done ? (
        <>
          <p className="text-sm text-muted">
            {t("report.thanksPrefix")}{" "}
            <span className="font-medium text-ink">{deckName || t("report.thisDeck")}</span>.
          </p>
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="focus-ring rounded-input bg-accent px-4 py-2 text-sm font-semibold text-white shadow-btn transition hover:opacity-95"
            >
              {t("common.done")}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-muted">
            {t("report.tellUsPrefix")}{" "}
            <span className="font-medium text-ink">{deckName || t("report.thisDeck")}</span>.{" "}
            {t("report.privateNotice")}
          </p>
          <div className="mt-4 space-y-3">
            <div className="space-y-1">
              <span id={reasonLabelId} className="block text-xs font-medium text-muted">
                {t("report.reason")}
              </span>
              <Select
                value={reason}
                options={REASONS.map((r) => ({ value: r, label: t(DECK_REPORT_REASON_KEYS[r]) }))}
                onChange={setReason}
                ariaLabelledBy={reasonLabelId}
                fullWidth
              />
            </div>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted">{t("report.details")}</span>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                maxLength={1000}
                rows={3}
                placeholder={t("report.detailsPlaceholder")}
                className={fieldClasses}
              />
            </label>
          </div>

          {report.isError && (
            <p className="mt-3 rounded-input bg-danger/10 px-3 py-2 text-sm text-danger">
              {t("report.sendFailed")}
            </p>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={report.isPending}
              className="rounded-input border border-line-strong bg-surface px-4 py-2 text-sm font-medium text-muted transition hover:text-ink disabled:opacity-50"
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={report.isPending}
              className="focus-ring inline-flex items-center gap-2 rounded-input bg-accent px-4 py-2 text-sm font-semibold text-white shadow-btn transition hover:opacity-95 disabled:opacity-60"
            >
              {report.isPending && <Spinner className="h-4 w-4" />}
              {t("report.submit")}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
