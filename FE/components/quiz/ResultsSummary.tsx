import type { AnswerRecord } from "@/stores/quizStore";

export function ResultsSummary({
  answers,
  score,
  total,
  onRetry,
  onNewDeck,
}: {
  answers: AnswerRecord[];
  score: number;
  total: number;
  onRetry: () => void;
  onNewDeck: () => void;
}) {
  const pct = total === 0 ? 0 : Math.round((score / total) * 100);
  const missed = answers.filter((a) => !a.wasCorrect);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-neutral-200 p-6 text-center dark:border-neutral-800">
        <p className="text-sm text-neutral-500">Your score</p>
        <p className="mt-1 text-4xl font-semibold">{pct}%</p>
        <p className="mt-1 text-sm text-neutral-500">
          {score} of {total} correct
        </p>
      </div>

      {missed.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">
            Missed cards ({missed.length})
          </h2>
          <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
            {missed.map((a, i) => (
              <li key={`${a.noteId}-${i}`} className="flex justify-between gap-4 p-3 text-sm">
                <span className="break-words">{a.question}</span>
                <span className="shrink-0 font-medium text-green-700 dark:text-green-400">
                  {a.correct}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onRetry}
          className="flex-1 rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
        >
          Retry
        </button>
        <button
          type="button"
          onClick={onNewDeck}
          className="flex-1 rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          Back to decks
        </button>
      </div>
    </div>
  );
}
