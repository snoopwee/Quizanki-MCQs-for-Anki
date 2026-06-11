const HIGH_CONFIDENCE = 0.7;

export function ConfidenceBadge({ confidence }: { confidence: number }) {
  const high = confidence >= HIGH_CONFIDENCE;
  const pct = Math.round(confidence * 100);

  return (
    <span
      className={
        high
          ? "inline-flex items-center rounded-full bg-success/15 px-2.5 py-0.5 font-mono text-xs font-medium text-success"
          : "inline-flex items-center rounded-full bg-warning/15 px-2.5 py-0.5 font-mono text-xs font-medium text-warning"
      }
    >
      {high ? "High confidence" : "Low confidence"} · {pct}%
    </span>
  );
}
