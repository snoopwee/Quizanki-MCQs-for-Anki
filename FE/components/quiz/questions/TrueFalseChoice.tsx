import { Icon } from "@/components/ui/icons";
import { RichText } from "@/components/shared/RichText";
import { textDirection } from "@/lib/displayText";
import { trueFalseLabel } from "@/lib/questionAnswer";

// True/False: the asserted statement above two verdict buttons. After answering,
// the correct verdict goes green and a wrong pick goes red (mirroring OptionButton).
export function TrueFalseChoice({
  statement,
  truth,
  answered,
  picked,
  onPick,
}: {
  statement: string;
  truth: boolean;
  answered: boolean;
  picked: string | null;
  onPick: (pick: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-card border border-line-strong bg-surface-2 p-5 text-center">
        <p className="font-mono text-[0.6875rem] uppercase tracking-wide text-faint">Proposed answer</p>
        <p
          dir={textDirection(statement)}
          className="mt-2 font-display text-2xl font-semibold leading-tight break-words text-ink"
        >
          <RichText text={statement} />
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[true, false].map((val) => {
          const label = trueFalseLabel(val);
          const isPicked = picked === label;
          const isRight = val === truth;
          const showCorrect = answered && isRight;
          const showWrong = answered && isPicked && !isRight;
          let cls =
            "focus-ring flex items-center justify-center gap-2 rounded-card border px-4 py-5 text-base font-semibold transition ";
          if (showCorrect) cls += "border-success bg-success/10 text-ink";
          else if (showWrong) cls += "border-danger bg-danger/10 text-ink";
          else if (answered) cls += "border-line text-faint";
          else cls += "border-line-strong bg-surface text-ink hover:border-accent hover:bg-accent-soft";
          return (
            <button key={label} type="button" disabled={answered} onClick={() => onPick(val)} className={cls}>
              <Icon name={val ? "check" : "x"} size={18} />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
