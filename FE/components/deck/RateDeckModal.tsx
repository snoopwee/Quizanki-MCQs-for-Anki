"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/shared/Modal";
import { StarPicker } from "@/components/ui/StarRating";
import { Icon } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/Spinner";
import { buttonClasses } from "@/components/ui/Button";
import { useDeckRating, useRateDeck, useRemoveDeckRating } from "@/hooks/useDeckRating";
import { useT } from "@/components/i18n/LocaleProvider";
import type { MessageKey } from "@/lib/i18n/messages/en";

const MAX_NOTE = 1000;

/**
 * Rate someone else's deck: stars, and an optional note.
 *
 * A modal rather than a panel on the page, opened from the "Rate it" button beside the score. The
 * old inline panel sat below the deck and asked for a verdict from anyone who scrolled that far;
 * this asks only when somebody decides to answer.
 *
 * The stars are public; the note is NOT — it reaches only this deck's author. That is said before
 * the textarea, not after, because people write differently when they think a comment is public.
 */
export function RateDeckModal({ deckId, onClose }: { deckId: string; onClose: () => void }) {
  const rating = useDeckRating(deckId);
  const rate = useRateDeck(deckId);
  const remove = useRemoveDeckRating(deckId);
  const t = useT();

  const [stars, setStars] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [dirty, setDirty] = useState(false);

  // Seed from the server once, and re-seed if it changes underneath (another tab, a removal).
  // `dirty` keeps an in-progress edit from being overwritten by a refetch.
  useEffect(() => {
    if (!rating.data || dirty) return;
    setStars(rating.data.myStars);
    setNote(rating.data.myNote ?? "");
  }, [rating.data, dirty]);

  const saved = rating.data?.myStars != null;
  const changed =
    stars !== (rating.data?.myStars ?? null) ||
    note.trim() !== (rating.data?.myNote ?? "").trim();

  function submit() {
    if (stars === null) return;
    rate.mutate({ stars, note: note.trim() || null }, { onSuccess: onClose });
  }

  return (
    <Modal title={saved ? t("deckPage.yourRating") : t("rate.title")} onClose={onClose}>
      {rating.isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Spinner className="h-4 w-4 text-accent" /> {t("common.loading")}
        </p>
      ) : rating.isError || !rating.data ? (
        <p className="text-sm text-danger">{t("rate.loadFailed")}</p>
      ) : (
        <>
          <div className="flex flex-col items-center gap-2 py-2">
            <StarPicker value={stars} onPick={(next) => { setStars(next); setDirty(true); }}
                        disabled={rate.isPending} size={30} />
            <p className="h-4 text-xs text-muted">{stars ? t(STAR_WORD_KEYS[stars - 1]) : t("rate.pick")}</p>
          </div>

          <div className="mt-2 space-y-1.5">
            <label htmlFor="rating-note" className="flex items-center gap-1.5 text-xs text-muted">
              <Icon name="lock" size={13} className="shrink-0" />
              {/* The whole point of the design: say it before they type, not after. */}
              {t("rate.privateNote")}
            </label>
            <textarea
              id="rating-note"
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                setDirty(true);
              }}
              maxLength={MAX_NOTE}
              rows={3}
              placeholder={t("rate.notePlaceholder")}
              className="focus-ring w-full resize-y rounded-input border border-line-strong bg-surface-2 px-3 py-2 text-sm text-ink outline-none placeholder:text-faint"
            />
          </div>

          {rate.isError && (
            <p className="mt-2 text-sm text-danger">
              {ratingError(rate.error, t("rate.saveFailed"))}
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
            {saved && (
              <button
                type="button"
                onClick={() => remove.mutate(undefined, { onSuccess: onClose })}
                disabled={remove.isPending}
                className={buttonClasses({ variant: "ghost", size: "sm", className: "mr-auto" })}
              >
                {remove.isPending && <Spinner className="h-3.5 w-3.5 text-muted" label={t("rate.removing")} />}
                {t("rate.remove")}
              </button>
            )}
            <button type="button" onClick={onClose} className={buttonClasses({ variant: "ghost" })}>
              {t("common.cancel")}
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={stars === null || rate.isPending || (saved && !changed)}
              className={buttonClasses({ variant: "primary" })}
            >
              {rate.isPending && <Spinner className="h-3.5 w-3.5 text-white" label={t("rate.saving")} />}
              {saved ? t("rate.update") : t("rate.post")}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

// Shown under the picker so a click has a word attached to it, not just a count of stars. Keys
// rather than words: this is module scope, where there is no translator to call.
//
// A 5-tuple, not an array: it is indexed by `stars - 1` with no bounds check, so the type is what
// stops a deleted entry from reaching `t(undefined)` at runtime. Length tracks STARS.
const STAR_WORD_KEYS: readonly [MessageKey, MessageKey, MessageKey, MessageKey, MessageKey] = [
  "rate.star1",
  "rate.star2",
  "rate.star3",
  "rate.star4",
  "rate.star5",
];

// The backend's own message when there is one — it names the reason (your own deck, bad stars).
function ratingError(error: unknown, fallback: string): string {
  const message = (error as { response?: { data?: { message?: string } } } | null)?.response?.data
    ?.message;
  return message ?? fallback;
}
