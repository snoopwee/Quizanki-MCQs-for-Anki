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

// Warm design-system tokens (see FE/DESIGN_SYSTEM.md): learning→danger,
// practicing→warning (ochre), mastered→success (moss), new→neutral.
const STAGE_PILL: Record<MasteryStage, string> = {
  new: "bg-surface-2 text-muted ring-1 ring-inset ring-line-strong",
  learning: "bg-danger/12 text-danger ring-1 ring-inset ring-danger/30",
  practicing: "bg-warning/12 text-warning ring-1 ring-inset ring-warning/30",
  mastered: "bg-success/12 text-success ring-1 ring-inset ring-success/30",
};

const STAGE_BAR: Record<MasteryStage, string> = {
  new: "bg-line-strong",
  learning: "bg-danger",
  practicing: "bg-warning",
  mastered: "bg-success",
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
