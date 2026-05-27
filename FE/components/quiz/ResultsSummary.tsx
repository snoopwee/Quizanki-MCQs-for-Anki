import type { AnswerRecord } from "@/stores/quizStore";
import { CardPreviewRow } from "@/components/deck/CardPreview";

export function ResultsSummary({
  answers,
  score,
  total,
  onRetakeSame,
  onRetakeWrong,
  onRetakeNew,
  onBackToDeck,
}: {
  answers: AnswerRecord[];
  score: number;
  total: number;
  // Replay the exact same set of questions that was just shown.
  onRetakeSame: () => void;
  // Replay only the cards answered incorrectly.
  onRetakeWrong: () => void;
  // Build a fresh quiz from the deck.
  onRetakeNew: () => void;
  // Leave the quiz and go back to the deck.
  onBackToDeck: () => void;
}) {
  const pct = total === 0 ? 0 : Math.round((score / total) * 100);
  const missed = answers.filter((a) => !a.wasCorrect);

  const buttonClass =
    "rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100 disabled:opacity-40 dark:border-neutral-700 dark:hover:bg-neutral-900";

  return (
    <div className="space-y-6">
      {/* Result card: score on the left, the four actions as a 2×2 grid on the right. */}
      <div className="rounded-lg border border-neutral-200 p-6 dark:border-neutral-800">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-neutral-500">Your score</p>
            <p className="mt-1 text-4xl font-semibold">{pct}%</p>
            <p className="mt-1 text-sm text-neutral-500">
              {score} of {total} correct
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={onRetakeSame} className={buttonClass}>
              Retake with the same card
            </button>
            <button
              type="button"
              onClick={onRetakeWrong}
              disabled={missed.length === 0}
              className={buttonClass}
            >
              Retake with the missed cards
            </button>
            <button type="button" onClick={onRetakeNew} className={buttonClass}>
              New test
            </button>
            <button type="button" onClick={onBackToDeck} className={buttonClass}>
              Back to decks
            </button>
          </div>
        </div>
      </div>

      {missed.length > 0 ? (
        <div className="space-y-2">
          <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">
            Missed cards ({missed.length})
          </h2>
          <ul className="space-y-2">
            {missed.map((a, i) => (
              <CardPreviewRow
                key={`${a.noteId}-${i}`}
                front={a.prompt.map((seg) => seg.value)}
                back={[a.correct]}
              />
            ))}
          </ul>
        </div>
      ) : (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-900/30 dark:text-green-300">
          Perfect run — no missed cards.
        </p>
      )}
    </div>
  );
}
