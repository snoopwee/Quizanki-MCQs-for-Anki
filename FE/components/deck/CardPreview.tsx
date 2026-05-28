// Shared card-preview primitives used by both the flashcard study screen and the
// quiz results "missed cards" list, so the two lists look identical.

import { classifyMastery, type StageInfo } from "@/lib/masteryStage";

// Renders each field value on its own line, or a muted placeholder when empty.
export function Lines({ values, className = "" }: { values: string[]; className?: string }) {
  if (values.length === 0) {
    return <span className="text-neutral-400">(empty)</span>;
  }
  return (
    <>
      {values.map((v, i) => (
        <span key={i} className={`block break-words ${className}`}>
          {v}
        </span>
      ))}
    </>
  );
}

// Small status pill: "Learning · 25%", colour-coded by mastery stage.
export function StageBadge({ info }: { info: StageInfo }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${info.pillClass}`}
    >
      <span>{info.label}</span>
      {info.stage !== "new" && (
        <>
          <span aria-hidden className="opacity-60">
            ·
          </span>
          <span className="tabular-nums">{info.percent}%</span>
        </>
      )}
    </span>
  );
}

// A single front/back row. Grid so the row height is driven by the FRONT column;
// the back cell stretches to that height and its content scrolls (the absolute
// child has no intrinsic height, so a long back can't push the row taller).
//
// `stats`, when present, surfaces a colour-coded mastery badge above the row so
// the learner sees per-card progress as they scan the deck.
export function CardPreviewRow({
  front,
  back,
  stats,
}: {
  front: string[];
  back: string[];
  stats?: { mastery?: number; timesSeen?: number };
}) {
  const info = stats ? classifyMastery(stats) : null;
  return (
    <li className="space-y-2 rounded-lg border border-neutral-200 p-4 text-sm dark:border-neutral-800">
      {info && <StageBadge info={info} />}
      <div className="grid grid-cols-[1fr_2fr] gap-4">
        <div className="space-y-0.5 font-medium">
          <Lines values={front} />
        </div>
        <div className="relative border-l border-neutral-200 dark:border-neutral-700">
          <div className="nice-scroll absolute inset-0 space-y-0.5 overflow-y-auto pl-4 text-neutral-600 dark:text-neutral-300">
            <Lines values={back} />
          </div>
        </div>
      </div>
    </li>
  );
}
