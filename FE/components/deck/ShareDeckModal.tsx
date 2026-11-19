"use client";

import { useState } from "react";
import { Modal } from "@/components/shared/Modal";
import { Toggle } from "@/components/ui/controls";
import { Icon } from "@/components/ui/icons";
import { useShareDeck } from "@/hooks/useDecks";
import { useSession } from "@/hooks/useSession";
import { currentShareUrl } from "@/lib/shareLink";
import type { DeckContentsResponse } from "@/types/api";
import { useT } from "@/components/i18n/LocaleProvider";

/**
 * "Share deck" from the deck's ⋯ menu. One switch: while it's on, anyone with
 * the link can preview the deck and take their own copy of it. Nothing about the
 * owner's cards or progress is exposed for editing, and a copy never writes back.
 */
export function ShareDeckModal({
  contents,
  onClose,
}: {
  contents: DeckContentsResponse;
  onClose: () => void;
}) {
  const share = useShareDeck(contents.id);
  const { user } = useSession();
  const [copied, setCopied] = useState(false);

  // Drive the switch off the mutation's own result while it's in flight, so the
  // toggle flips instantly instead of waiting for the contents refetch.
  const isPublic = share.data?.isPublic ?? contents.isPublic;
  const url = currentShareUrl(contents.id);

  // You can only publish a deck you're credited for. An untouched copy still
  // credits its original author, so publishing it would just add a duplicate to
  // Discover — editing it makes it (and this permission) yours. The backend
  // enforces this too; this is the explanation, not the guard.
  const canShare = !user || contents.authorId === user.id;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const t = useT();
  return (
    <Modal title={t("share.title")} onClose={onClose}>
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4 rounded-card border border-line bg-surface-2 p-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">{t("share.anyoneWithLink")}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted">
              {t("share.explain", { name: contents.name })}
            </p>
          </div>
          <Toggle
            on={isPublic}
            disabled={share.isPending || (!canShare && !isPublic)}
            onChange={(next) => share.mutate(next)}
          />
        </div>

        {!canShare && !isPublic && (
          <p className="rounded-input border border-warning/30 bg-warning/10 px-3 py-2 text-xs leading-relaxed text-warning">
            {t("share.isACopy", {
              author: contents.authorName ?? t("share.someoneElse"),
            })}
          </p>
        )}

        {isPublic ? (
          <div className="space-y-2">
            <span className="font-mono text-xs font-medium text-faint">{t("share.link")}</span>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={url}
                onFocus={(e) => e.currentTarget.select()}
                aria-label={t("share.link")}
                className="focus-ring min-w-0 flex-1 rounded-input border border-line-strong bg-surface-2 px-3 py-2 font-mono text-xs text-ink outline-none"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-input bg-accent px-3 py-2 text-sm font-semibold text-white shadow-btn transition hover:opacity-95"
              >
                <Icon name={copied ? "check" : "copy"} size={15} />
                {copied ? t("share.copied") : t("share.copy")}
              </button>
            </div>
            <p className="text-xs text-faint">
              {t("share.linkOnlyWhileOn")}
            </p>
          </div>
        ) : (
          <p className="rounded-input bg-surface-2 px-3 py-2 text-xs text-muted">
            {t("share.privateNow")}
          </p>
        )}

        {share.isError && (
          <p className="text-sm text-danger">
            {canShare ? t("share.updateFailed") : t("share.editFirst")}
          </p>
        )}

        <div className="flex justify-end border-t border-line pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-input border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium transition hover:border-accent hover:text-accent"
          >
            {t("common.done")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
