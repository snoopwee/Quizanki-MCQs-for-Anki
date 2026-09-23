"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useDeckContents } from "@/hooks/useDecks";
import { useDeckFeedback, useDeleteFeedbackNote } from "@/hooks/useDeckRating";
import { ReportNoteModal } from "@/components/deck/ReportNoteModal";
import { StarRating } from "@/components/ui/StarRating";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/Spinner";
import { buttonClasses } from "@/components/ui/Button";
import { relativeTime } from "@/lib/notificationDisplay";
import { starFills } from "@/lib/ratingDisplay";

// What people wrote about one deck — for its author alone. The backend answers 404 to anyone else,
// so there is no owner check to get wrong here; this page just renders what it is given.
export default function DeckFeedbackPage() {
  const { deckId } = useParams<{ deckId: string }>();
  const deck = useDeckContents(deckId);
  const feedback = useDeckFeedback(deckId);
  const remove = useDeleteFeedbackNote(deckId);
  const [confirming, setConfirming] = useState<string | null>(null);
  // Reporting and deleting are different intents: deleting is "I don't want to read this",
  // reporting is "somebody should deal with whoever wrote it".
  const [reporting, setReporting] = useState<{ id: string; note: string } | null>(null);

  const notes = feedback.data?.notes ?? [];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href={`/decks/${deckId}`} className={buttonClasses({ variant: "ghost", size: "sm" })}>
          <Icon name="chevronLeft" size={15} />
          Back to deck
        </Link>
        <h1 className="mt-3 font-display text-2xl font-bold tracking-tight text-ink">Feedback</h1>
        <p className="mt-1 text-sm text-muted">
          What people wrote when they rated{" "}
          <span className="font-medium text-ink">{deck.data?.name ?? "this deck"}</span>. Only you
          can see these. Names aren&apos;t shown — one rating per person, so every note is someone
          different.
        </p>
      </div>

      {feedback.data && (
        <div className="flex items-center gap-3 rounded-card border border-line bg-surface px-4 py-3">
          <StarRating average={feedback.data.average} count={feedback.data.count} size={16} />
        </div>
      )}

      {feedback.isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Spinner className="h-5 w-5 text-accent" /> Loading feedback…
        </p>
      ) : feedback.isError ? (
        <p className="rounded-card border border-danger/30 bg-danger/10 px-4 py-6 text-sm text-danger">
          Couldn&apos;t load this deck&apos;s feedback.
        </p>
      ) : notes.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 border-dashed px-6 py-14 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-input bg-accent-soft text-accent">
            <Icon name="star" size={24} />
          </span>
          <p className="text-sm font-medium text-ink">No notes yet.</p>
          <p className="max-w-xs text-sm text-muted">
            People can leave one when they rate your deck. Ratings without a note still count
            towards your score.
          </p>
        </Card>
      ) : (
        <ul className="space-y-3">
          {notes.map((item) => (
            <li key={item.id}>
              <Card className="space-y-2 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span aria-hidden className="inline-flex items-center gap-0.5 text-warning">
                    {starFills(item.stars).map((fill, i) => (
                      <Icon
                        key={i}
                        name="star"
                        size={14}
                        className={fill === "full" ? "fill-current" : "text-line-strong"}
                      />
                    ))}
                    <span className="sr-only">{item.stars} out of 5</span>
                  </span>
                  <span className="font-mono text-xs text-faint">
                    {relativeTime(item.writtenAt)}
                  </span>
                </div>

                <p className="whitespace-pre-wrap break-words text-sm text-ink">{item.note}</p>

                {confirming === item.id ? (
                  <div className="space-y-1.5 rounded-input border border-danger/30 bg-danger/5 p-2.5">
                    <p className="text-xs font-semibold text-ink">Delete this note?</p>
                    {/* The rule, said out loud where it matters most. */}
                    <p className="text-xs text-muted">
                      Their {item.stars}-star rating stays and still counts towards your score —
                      only the text goes.
                    </p>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setConfirming(null)}
                        className={buttonClasses({ variant: "ghost", size: "sm" })}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          remove.mutate(item.id, { onSuccess: () => setConfirming(null) })
                        }
                        disabled={remove.isPending}
                        className={buttonClasses({ variant: "danger", size: "sm" })}
                      >
                        {remove.isPending && (
                          <Spinner className="h-3.5 w-3.5 text-danger" label="Deleting" />
                        )}
                        Delete note
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setConfirming(item.id)}
                      className="focus-ring rounded-input px-1.5 py-0.5 text-xs font-semibold text-muted transition hover:text-danger"
                    >
                      Delete note
                    </button>
                    <button
                      type="button"
                      onClick={() => setReporting({ id: item.id, note: item.note })}
                      className="focus-ring rounded-input px-1.5 py-0.5 text-xs font-semibold text-muted transition hover:text-accent"
                    >
                      Report to admin
                    </button>
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-muted">
        Deleting a note removes the text for good — their rating stays either way. Report it instead
        if somebody should look at who wrote it; an admin will tell you what they decided.
      </p>

      {reporting && (
        <ReportNoteModal
          deckId={deckId}
          noteId={reporting.id}
          noteText={reporting.note}
          onClose={() => setReporting(null)}
        />
      )}
    </div>
  );
}
