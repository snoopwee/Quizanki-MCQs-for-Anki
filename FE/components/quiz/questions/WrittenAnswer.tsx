import { Icon } from "@/components/ui/icons";
import { RichText } from "@/components/shared/RichText";
import { textDirection } from "@/lib/displayText";
import type { WrittenResult } from "@/lib/questionAnswer";

// Written: a free-text field the learner types into, then checks. Grading is
// lenient (see gradeWritten) but imperfect, so a missed auto-grade offers an
// "I was right" override — the caller records the final verdict when moving on.
// State lives in `useWrittenAnswer`.
export function WrittenAnswer({
  input,
  onInput,
  onCheck,
  result,
  correct,
  onToggleOverride,
}: {
  input: string;
  onInput: (v: string) => void;
  onCheck: () => void;
  result: WrittenResult | null;
  correct: string;
  onToggleOverride: () => void;
}) {
  const revealed = result !== null;
  return (
    <div className="space-y-3">
      <input
        autoFocus
        value={input}
        onChange={(e) => onInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !revealed) {
            e.preventDefault();
            onCheck();
          }
        }}
        disabled={revealed}
        dir={textDirection(input)}
        placeholder="Type the answer…"
        aria-label="Your answer"
        className="focus-ring w-full rounded-card border border-line-strong bg-surface px-4 py-3.5 text-lg text-ink disabled:opacity-70"
      />

      {!revealed && (
        <button
          type="button"
          onClick={onCheck}
          className="focus-ring w-full rounded-input bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-btn transition hover:opacity-95"
        >
          Check answer
        </button>
      )}

      {result && (
        <div
          className={`rounded-card border p-4 ${
            result.autoCorrect || result.override
              ? "border-success/40 bg-success/10"
              : "border-danger/40 bg-danger/10"
          }`}
        >
          <p className="font-mono text-[0.6875rem] uppercase tracking-wide text-faint">Correct answer</p>
          <p dir={textDirection(correct)} className="mt-1 font-display text-xl font-semibold break-words text-ink">
            <RichText text={correct} />
          </p>
          {!result.autoCorrect && (
            <button
              type="button"
              onClick={onToggleOverride}
              aria-pressed={result.override}
              className="mt-3 inline-flex items-center gap-1.5 rounded-input border border-line-strong bg-surface px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-accent"
            >
              <Icon name={result.override ? "check" : "pencil"} size={13} />
              {result.override ? "Counted as correct" : "I was right — count it"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
