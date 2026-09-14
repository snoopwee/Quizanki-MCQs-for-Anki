import { Card } from "@/components/ui/Card";
import { Ring } from "@/components/ui/Ring";
import { Icon } from "@/components/ui/icons";
import { buttonClasses } from "@/components/ui/Button";
import { RichText } from "@/components/shared/RichText";
import { textDirection } from "@/lib/displayText";
import { MASTERY_STAGES, stageStyle, type MasteryStage } from "@/lib/masteryStage";
import type { LearnSummary } from "@/lib/learnSession";

// The end of a Learn session: first-try accuracy, where the cards now stand on the
// mastery scale, and the cards that took more than one try.
export function LearnSummaryView({
  summary,
  stages,
  onKeepLearning,
  onExit,
}: {
  summary: LearnSummary;
  stages: Record<MasteryStage, number>;
  onKeepLearning: () => void;
  onExit: () => void;
}) {
  const pct = summary.total > 0 ? Math.round((summary.firstTry / summary.total) * 100) : 0;
  const headline = pct === 100 ? "Flawless!" : pct >= 70 ? "Nicely done!" : "Every card learned!";
  const stageTotal = MASTERY_STAGES.reduce((sum, stage) => sum + stages[stage], 0);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card className="accent-top p-0">
        <div className="h-1.5" aria-hidden />
        <div className="flex flex-col items-center gap-6 p-7 sm:flex-row">
          <Ring value={pct / 100} size={120} stroke={9} label={`${pct}%`} />
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <p className="font-mono text-xs uppercase tracking-[0.08em] text-faint">Session complete</p>
            <h2 className="mt-1 font-display text-3xl font-bold tracking-tight text-ink">{headline}</h2>
            <p className="mt-1 text-sm text-muted">
              You learned{" "}
              <strong className="text-ink">
                {summary.total} card{summary.total === 1 ? "" : "s"}
              </strong>
              . {summary.firstTry} right on the first try, {summary.answers} answer
              {summary.answers === 1 ? "" : "s"} in all.
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="text-[0.9375rem] font-bold text-ink">Where these cards stand</h3>
        <p className="mt-0.5 text-xs text-muted">
          Mastery after this session. Every answer counts, just like in a quiz.
        </p>
        {stageTotal > 0 && (
          <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden>
            {MASTERY_STAGES.map((stage) =>
              stages[stage] > 0 ? (
                <div
                  key={stage}
                  className={stageStyle(stage).barClass}
                  style={{ width: `${(stages[stage] / stageTotal) * 100}%` }}
                />
              ) : null,
            )}
          </div>
        )}
        <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
          {MASTERY_STAGES.map((stage) => (
            <li key={stage} className="flex items-center gap-2 text-sm text-muted">
              <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-full ${stageStyle(stage).barClass}`} />
              <span className="truncate">{stageStyle(stage).label}</span>
              <span className="ml-auto font-mono font-bold text-ink">{stages[stage]}</span>
            </li>
          ))}
        </ul>
      </Card>

      {summary.missed.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-mono text-xs font-medium uppercase tracking-wide text-faint">
            Took more than one try
          </h3>
          <ul className="space-y-2">
            {summary.missed.map((card) => (
              <li
                key={card.template.key}
                className="flex items-center gap-3 rounded-input border border-line bg-surface px-4 py-3 text-sm"
              >
                <span className="min-w-0 flex-1">
                  <span
                    dir={textDirection(card.template.base.question)}
                    className="block truncate font-medium text-ink"
                  >
                    <RichText text={card.template.base.question} />
                  </span>
                  <span dir={textDirection(card.template.base.correct)} className="block truncate text-muted">
                    <RichText text={card.template.base.correct} />
                  </span>
                </span>
                <span className="shrink-0 font-mono text-danger">
                  missed {card.misses} time{card.misses === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onExit} className={buttonClasses({ variant: "ghost", className: "grow basis-40" })}>
          Back to deck
        </button>
        <button
          type="button"
          onClick={onKeepLearning}
          className={buttonClasses({ variant: "primary", className: "grow basis-40" })}
        >
          <Icon name="brain" size={16} />
          Keep learning
        </button>
      </div>
    </div>
  );
}
