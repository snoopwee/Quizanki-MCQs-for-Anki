import type { AnswerRecord } from "@/stores/quizStore";
import { Card } from "@/components/ui/Card";
import { Ring } from "@/components/ui/Ring";
import { Icon } from "@/components/ui/icons";
import { buttonClasses } from "@/components/ui/Button";
import { CardPreviewRow } from "@/components/deck/CardPreview";

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

      {/* actions — kept above the review list so they're reachable without
          scrolling past every card */}
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

      {/* review list — each answered card shown front/back like the flashcard
          list, with a correct/missed pill in place of the per-row actions */}
      <div className="space-y-2">
        <h3 className="font-mono text-xs font-medium uppercase tracking-wide text-faint">Review answers</h3>
        <ul className="space-y-2">
          {answers.map((a, i) => (
            <CardPreviewRow
              key={`${a.noteId}-${i}`}
              front={a.prompt.map((seg) => seg.value)}
              back={[a.correct]}
              stats={{ mastery: a.newMastery, timesSeen: 1 }}
              action={
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                    a.wasCorrect ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
                  }`}
                >
                  <Icon name={a.wasCorrect ? "check" : "x"} size={13} />
                  {a.wasCorrect ? "Correct" : "Missed"}
                </span>
              }
            />
          ))}
        </ul>
      </div>
    </div>
  );
}
