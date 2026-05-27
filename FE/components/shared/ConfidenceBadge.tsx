const HIGH_CONFIDENCE = 0.7;

export function ConfidenceBadge({ confidence }: { confidence: number }) {
  const high = confidence >= HIGH_CONFIDENCE;
  const pct = Math.round(confidence * 100);

  return (
    <span
      className={
        high
          ? "inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/40 dark:text-green-300"
          : "inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
      }
    >
      {high ? "High confidence" : "Low confidence"} · {pct}%
    </span>
  );
}
