"use client";

import { useState } from "react";
import { Modal } from "@/components/shared/Modal";
import { Toggle } from "@/components/ui/controls";
import { Icon } from "@/components/ui/icons";
import { useShareDeck } from "@/hooks/useDecks";
import { useSession } from "@/hooks/useSession";
import { currentShareUrl } from "@/lib/shareLink";
import type { DeckContentsResponse } from "@/types/api";

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

  return (
    <Modal title="Share deck" onClose={onClose}>
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4 rounded-card border border-line bg-surface-2 p-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">Anyone with the link</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted">
              They can view <span className="font-medium text-ink">{contents.name}</span> and save
              their own copy of it. Your cards and your progress stay yours — a copy is a separate
              deck and never writes back here.
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
            This is a copy of{" "}
            <span className="font-semibold">{contents.authorName ?? "someone else"}</span>&apos;s
            deck, so it&apos;s still credited to them. Edit a card to make it your own — then you
            can share it.
          </p>
        )}

        {isPublic ? (
          <div className="space-y-2">
            <span className="font-mono text-xs font-medium text-faint">Share link</span>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={url}
                onFocus={(e) => e.currentTarget.select()}
                aria-label="Share link"
                className="focus-ring min-w-0 flex-1 rounded-input border border-line-strong bg-surface-2 px-3 py-2 font-mono text-xs text-ink outline-none"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-input bg-accent px-3 py-2 text-sm font-semibold text-white shadow-btn transition hover:opacity-95"
              >
                <Icon name={copied ? "check" : "copy"} size={15} />
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="text-xs text-faint">
              The link only works while sharing is on — switch it off and it stops opening.
            </p>
          </div>
        ) : (
          <p className="rounded-input bg-surface-2 px-3 py-2 text-xs text-muted">
            This deck is private. Turn sharing on to get a link you can send to anyone.
          </p>
        )}

        {share.isError && (
          <p className="text-sm text-danger">
            {canShare
              ? "Couldn't update sharing. Please try again."
              : "Edit a card in this copy to make it your own before sharing it."}
          </p>
        )}

        <div className="flex justify-end border-t border-line pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-input border border-line-strong bg-surface px-3 py-1.5 text-sm font-medium transition hover:border-accent hover:text-accent"
          >
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}
