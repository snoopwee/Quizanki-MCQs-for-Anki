// SVG progress ring for mastery / score / deck completion. `value` is 0–1;
// `color` defaults to the accent but takes any CSS color (e.g. a subject hue).
export function Ring({
  value,
  size = 46,
  stroke = 4,
  color = "var(--accent)",
  label,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  label?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
          strokeLinecap="round"
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      {label && (
        <div
          className="absolute inset-0 grid place-items-center font-mono font-bold text-ink"
          style={{ fontSize: size * 0.26 }}
        >
          {label}
        </div>
      )}
    </div>
  );
}
