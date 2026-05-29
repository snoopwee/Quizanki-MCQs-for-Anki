// Buckets a per-card learning state into one of four named stages, with display
// metadata (label, percent, Tailwind colour classes). These thresholds drive
// the badge / progress UI only — the quiz selection algorithm in
// `buildQuestions.ts` uses a flat new-card share rather than gating on any
// mastery threshold, so the numbers here can be tuned for legibility without
// affecting selection.
//
// Stage naming note: the "Practicing" tier sits between Learning and Mastered.
// Alternatives the product could swap in without touching anything else:
//   - "Reviewing" (Anki-flavoured)
//   - "Familiar"  (closer to the user's original word)
//   - "Almost"    (Quizlet-style)

export type MasteryStage = "new" | "learning" | "practicing" | "mastered";

export interface StageInfo {
  stage: MasteryStage;
  label: string;
  // 0-100, rounded to an integer for display.
  percent: number;
  // Pill styling: background + text, with a thin ring so the colour reads
  // against both light and dark surfaces without overpowering the row.
  pillClass: string;
  // Solid-colour bar fill for inline progress bars.
  barClass: string;
}

const PRACTICING_THRESHOLD = 30;
const MASTERED_THRESHOLD = 80;

// Single-knob retune: if the product later picks a different name for the
// third stage, change it here and every surface follows.
const STAGE_LABEL: Record<MasteryStage, string> = {
  new: "New",
  learning: "Learning",
  practicing: "Practicing",
  mastered: "Mastered",
};

const STAGE_PILL: Record<MasteryStage, string> = {
  new: "bg-neutral-100 text-neutral-600 ring-1 ring-inset ring-neutral-300 dark:bg-neutral-800/60 dark:text-neutral-300 dark:ring-neutral-700",
  learning:
    "bg-red-100 text-red-700 ring-1 ring-inset ring-red-300 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900/60",
  practicing:
    "bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-300 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900/60",
  mastered:
    "bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/60",
};

const STAGE_BAR: Record<MasteryStage, string> = {
  new: "bg-neutral-300 dark:bg-neutral-700",
  learning: "bg-red-500 dark:bg-red-400",
  practicing: "bg-amber-500 dark:bg-amber-400",
  mastered: "bg-emerald-500 dark:bg-emerald-400",
};

export function classifyMastery(
  stats: { mastery?: number; timesSeen?: number } | undefined,
): StageInfo {
  const mastery = stats?.mastery ?? 0;
  const timesSeen = stats?.timesSeen ?? 0;

  // "New" only requires *never seen* — a card with mastery 0 that's been
  // answered (and immediately forgotten) is "Learning", not "New", so the UI
  // surfaces that the learner has interacted with it.
  let stage: MasteryStage;
  if (timesSeen === 0) stage = "new";
  else if (mastery >= MASTERED_THRESHOLD) stage = "mastered";
  else if (mastery >= PRACTICING_THRESHOLD) stage = "practicing";
  else stage = "learning";

  return {
    stage,
    label: STAGE_LABEL[stage],
    percent: Math.round(mastery),
    pillClass: STAGE_PILL[stage],
    barClass: STAGE_BAR[stage],
  };
}
