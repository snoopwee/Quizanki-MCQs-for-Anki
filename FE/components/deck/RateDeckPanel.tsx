"use client";

import { useEffect, useState } from "react";
import { StarPicker, StarRating } from "@/components/ui/StarRating";
import { Icon } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/Spinner";
import { buttonClasses } from "@/components/ui/Button";
import { useDeckRating, useRateDeck, useRemoveDeckRating } from "@/hooks/useDeckRating";

const MAX_NOTE = 1000;

// Rate someone else's deck. The stars are public; the note is not — it goes only to the deck's
// author, which the panel says plainly, because people write differently when they think a
// comment is public.
export function RateDeckPanel({ deckId }: { deckId: string }) {
  const rating = useDeckRating(deckId);
  const rate = useRateDeck(deckId);
  const remove = useRemoveDeckRating(deckId);

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

  if (rating.isLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted">
        <Spinner className="h-4 w-4 text-accent" /> Loading rating…
      </p>
    );
  }
  // Quiet: a rating panel that failed to load shouldn't take over someone's study page.
  if (rating.isError || !rating.data) return null;

  const saved = rating.data.myStars !== null;
  const changed =
    stars !== rating.data.myStars || note.trim() !== (rating.data.myNote ?? "").trim();

  function pick(next: number) {
    setStars(next);
    setDirty(true);
  }

  function submit() {
    if (stars === null) return;
    rate.mutate(
      { stars, note: note.trim() || null },
      { onSuccess: () => setDirty(false) },
    );
  }

  return (
    <div className="space-y-3 rounded-card border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-base font-semibold text-ink">
          {saved ? "Your rating" : "Rate this deck"}
        </h2>
        <StarRating average={rating.data.average} count={rating.data.count} />
      </div>

      <StarPicker value={stars} onPick={pick} disabled={rate.isPending} />

      <div className="space-y-1.5">
        <label htmlFor="rating-note" className="flex items-center gap-1.5 text-xs text-muted">
          <Icon name="lock" size={13} className="shrink-0" />
          {/* The whole point of the design: say it before they type, not after. */}
          Anything you write here is private — only this deck&apos;s author can read it.
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
          placeholder="What worked, what didn't, anything that would make it better…"
          className="focus-ring w-full resize-y rounded-input border border-line-strong bg-surface-2 px-3 py-2 text-sm text-ink outline-none placeholder:text-faint"
        />
      </div>

      {rate.isError && (
        <p className="text-sm text-danger">
          {ratingError(rate.error, "Couldn't save your rating. Try again.")}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={stars === null || rate.isPending || (saved && !changed)}
          className={buttonClasses({ variant: "primary", size: "sm" })}
        >
          {rate.isPending && <Spinner className="h-3.5 w-3.5 text-white" label="Saving" />}
          {saved ? "Update rating" : "Post rating"}
        </button>
        {saved && (
          <button
            type="button"
            onClick={() =>
              remove.mutate(undefined, {
                onSuccess: () => {
                  setStars(null);
                  setNote("");
                  setDirty(false);
                },
              })
            }
            disabled={remove.isPending}
            className={buttonClasses({ variant: "ghost", size: "sm" })}
          >
            {remove.isPending && <Spinner className="h-3.5 w-3.5 text-muted" label="Removing" />}
            Remove
          </button>
        )}
      </div>
    </div>
  );
}

// The backend's own message when there is one — it names the reason (your own deck, bad stars).
function ratingError(error: unknown, fallback: string): string {
  const message = (error as { response?: { data?: { message?: string } } } | null)?.response?.data
    ?.message;
  return message ?? fallback;
}
