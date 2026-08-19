"use client";

import { useId, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { DeckHistoryPoint } from "@/types/api";

// Accuracy-over-time line chart — a single series, so no legend (the heading
// names it). Pure inline SVG themed with the design tokens (var(--accent) line,
// recessive var(--line) grid, var(--faint) labels), so it adapts to light/dark
// automatically. Crosshair + tooltip on hover per the dataviz interaction rules.

// viewBox coordinate space; the SVG scales to its container via width:100%.
const W = 560;
const H = 190;
const PAD_L = 34; // room for the % axis labels
const PAD_R = 12;
const PAD_T = 12;
const PAD_B = 26; // room for the date labels
const INNER_W = W - PAD_L - PAD_R;
const INNER_H = H - PAD_T - PAD_B;

// `at` is an epoch-ms UTC instant; render it in the viewer's local time.
function shortDate(at: number): string {
  return new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function shortTime(at: number): string {
  return new Date(at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function AccuracyChart({ points }: { points: DeckHistoryPoint[] }) {
  const gradientId = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  if (points.length === 0) {
    return (
      <div className="grid h-44 place-items-center rounded-card border border-dashed border-line bg-surface-2/40 px-6 text-center">
        <p className="text-sm text-muted">
          No study history yet.
          <br />
          <span className="text-faint">Take a quiz and your accuracy will chart here.</span>
        </p>
      </div>
    );
  }

  const n = points.length;
  const x = (i: number) => (n <= 1 ? PAD_L + INNER_W / 2 : PAD_L + (i / (n - 1)) * INNER_W);
  const y = (acc: number) => PAD_T + (1 - Math.max(0, Math.min(1, acc))) * INNER_H;

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p.accuracy)}`).join(" ");
  // Area = the line, dropped to the baseline at both ends and closed.
  const baseline = PAD_T + INNER_H;
  const areaPath = `${linePath} L ${x(n - 1)} ${baseline} L ${x(0)} ${baseline} Z`;

  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  // Selective x labels: first, last, and a couple in between — never one per point.
  const labelStep = Math.max(1, Math.ceil(n / 5));
  const xLabelIndices = new Set<number>([0, n - 1]);
  for (let i = 0; i < n; i += labelStep) xLabelIndices.add(i);

  function onMove(e: ReactPointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    // Fraction across the whole viewBox width, then map to the nearest point.
    const vbX = ((e.clientX - rect.left) / rect.width) * W;
    let nearest = 0;
    let best = Infinity;
    for (let i = 0; i < n; i++) {
      const d = Math.abs(x(i) - vbX);
      if (d < best) {
        best = d;
        nearest = i;
      }
    }
    setHover(nearest);
  }

  const hoverPoint = hover === null ? null : points[hover];
  // Tooltip left position as a % of container width (viewBox x → fraction).
  const tooltipLeftPct = hover === null ? 0 : (x(hover) / W) * 100;
  const latest = points[n - 1];

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none"
        style={{ height: "auto" }}
        role="img"
        aria-label={`Accuracy across ${n} ${n === 1 ? "test" : "tests"}; most recent ${Math.round(
          latest.accuracy * 100,
        )} percent.`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* horizontal gridlines + % labels */}
        {gridLines.map((g) => {
          const gy = y(g);
          return (
            <g key={g}>
              <line
                x1={PAD_L}
                y1={gy}
                x2={W - PAD_R}
                y2={gy}
                stroke="var(--line)"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={PAD_L - 6}
                y={gy}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={10}
                fill="var(--faint)"
              >
                {Math.round(g * 100)}
              </text>
            </g>
          );
        })}

        {/* date labels */}
        {[...xLabelIndices]
          .sort((a, b) => a - b)
          .map((i) => (
            <text
              key={i}
              x={x(i)}
              y={H - 8}
              textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
              fontSize={10}
              fill="var(--faint)"
            >
              {shortDate(points[i].at)}
            </text>
          ))}

        {/* area + line */}
        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path
          d={linePath}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />

        {/* point markers — hidden once there are enough tests that dots crowd
            the line; the hover marker still pinpoints any test. */}
        {n <= 40 &&
          points.map((p, i) => (
            <circle key={i} cx={x(i)} cy={y(p.accuracy)} r={3} fill="var(--accent)" />
          ))}

        {/* hover crosshair + emphasized marker */}
        {hoverPoint && hover !== null && (
          <g>
            <line
              x1={x(hover)}
              y1={PAD_T}
              x2={x(hover)}
              y2={baseline}
              stroke="var(--accent)"
              strokeWidth={1}
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
              opacity={0.6}
            />
            <circle
              cx={x(hover)}
              cy={y(hoverPoint.accuracy)}
              r={5}
              fill="var(--surface)"
              stroke="var(--accent)"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        )}
      </svg>

      {/* tooltip */}
      {hoverPoint && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-input border border-line bg-surface px-2.5 py-1.5 text-center shadow-card"
          style={{ left: `${Math.max(12, Math.min(88, tooltipLeftPct))}%` }}
        >
          <div className="font-mono text-sm font-bold text-ink">
            {Math.round(hoverPoint.accuracy * 100)}%
          </div>
          <div className="text-[0.6875rem] text-muted">
            {shortDate(hoverPoint.at)}, {shortTime(hoverPoint.at)} · {hoverPoint.correct}/
            {hoverPoint.answered}
          </div>
        </div>
      )}
    </div>
  );
}
