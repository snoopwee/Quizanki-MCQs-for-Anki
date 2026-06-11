import type { AnswerRecord } from "@/stores/quizStore";
import { Card } from "@/components/ui/Card";
import { Ring } from "@/components/ui/Ring";
import { Icon } from "@/components/ui/icons";
import { SoonTag } from "@/components/ui/controls";
import { buttonClasses } from "@/components/ui/Button";

export function ResultsSummary({
  answers,
  score,
  total,
  onRetakeSame,
  onRetakeWrong,
  onRetakeNew,
  onEndTest,
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
  // End the test and return to the deck's flashcard list.
  onEndTest: () => void;
}) {
  const pct = total === 0 ? 0 : Math.round((score / total) * 100);
  const missed = answers.filter((a) => !a.wasCorrect);
  const verdict =
    pct >= 90 ? "Outstanding" : pct >= 70 ? "Great work" : pct >= 50 ? "Keep going" : "Worth another pass";
  const ringColor = pct >= 70 ? "var(--success)" : pct >= 50 ? "var(--warning)" : "var(--flame)";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* score hero */}
      <Card className="overflow-hidden p-0">
        <div className="h-1.5" style={{ background: ringColor }} />
        <div className="flex flex-col items-center gap-6 p-7 sm:flex-row">
          <Ring value={total ? score / total : 0} size={120} stroke={9} color={ringColor} label={`${pct}%`} />
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <p className="font-mono text-xs uppercase tracking-[0.08em] text-faint">Quiz complete</p>
            <h2 className="mt-1 font-display text-3xl font-bold tracking-tight text-ink">{verdict}!</h2>
            <p className="mt-1 text-sm text-muted">
              You got{" "}
              <strong className="text-ink">
                {score} of {total}
              </strong>{" "}
              correct.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 font-mono text-xs font-bold text-accent-ink">
                <Icon name="bolt" size={14} /> +{score * 12} XP <SoonTag />
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-flame/15 px-3 py-1.5 font-mono text-xs font-bold text-flame">
                <Icon name="flame" size={14} /> Streak +1 <SoonTag />
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* breakdown */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Correct", value: score, color: "var(--success)" },
          { label: "Incorrect", value: total - score, color: "var(--danger)" },
          { label: "Accuracy", value: `${pct}%`, color: "var(--accent)" },
        ].map((s) => (
          <Card key={s.label} className="p-4 text-center">
            <div className="font-display text-2xl font-bold tracking-tight" style={{ color: s.color }}>
              {s.value}
            </div>
            <div className="mt-0.5 text-xs text-muted">{s.label}</div>
          </Card>
        ))}
      </div>

      {/* review list */}
      <div className="space-y-2">
        <h3 className="font-mono text-xs font-medium uppercase tracking-wide text-faint">Review answers</h3>
        <Card className="overflow-hidden p-0">
          {answers.map((a, i) => (
            <div
              key={`${a.noteId}-${i}`}
              className="flex items-center gap-3.5 border-b border-line px-4 py-3 last:border-b-0"
            >
              <span
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-[7px] ${
                  a.wasCorrect ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
                }`}
              >
                <Icon name={a.wasCorrect ? "check" : "x"} size={14} />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                {a.prompt.map((seg) => seg.value).join(" · ")}
              </span>
              <span className="hidden max-w-[40%] shrink-0 truncate text-sm text-muted sm:block">
                {a.correct}
              </span>
            </div>
          ))}
        </Card>
      </div>

      {/* actions */}
      <div className="flex flex-wrap gap-2">
        <button onClick={onEndTest} className={buttonClasses({ variant: "ghost", className: "grow basis-32" })}>
          End
        </button>
        <button
          onClick={onRetakeWrong}
          disabled={missed.length === 0}
          className={buttonClasses({ variant: "ghost", className: "grow basis-32" })}
        >
          Retry missed
        </button>
        <button onClick={onRetakeSame} className={buttonClasses({ variant: "ghost", className: "grow basis-32" })}>
          Retake
        </button>
        <button onClick={onRetakeNew} className={buttonClasses({ variant: "primary", className: "grow basis-32" })}>
          New quiz
        </button>
      </div>
    </div>
  );
}
