import { Icon } from "@/components/ui/icons";
import { textDirection } from "@/lib/displayText";
import { RichText } from "@/components/shared/RichText";

// One MCQ answer: a lettered A–D badge + the option text (reference exam layout).
// After answering, the badge flips to a check (correct) / cross (your wrong pick),
// the correct option goes moss-green and a wrong pick goes brick-red.
export function OptionButton({
  option,
  index,
  answered,
  isCorrect,
  isSelected,
  onSelect,
}: {
  option: string;
  index: number;
  answered: boolean;
  isCorrect: boolean;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const showCorrect = answered && isCorrect;
  const showWrong = answered && isSelected && !isCorrect;
  // Chosen, but not yet graded — the Practice Test state. The quiz never reaches it (there,
  // answering grades immediately), but without it a test paper cannot show you your own pick:
  // `isSelected` was only ever consulted once `answered` was true, so all four options rendered
  // identically and your answer vanished the moment you moved to the next question.
  const showChosen = !answered && isSelected;

  let card = "focus-ring flex w-full items-start gap-3 rounded-card border px-4 py-4 text-left text-[0.9375rem] font-medium transition ";
  let badge = "grid h-7 w-7 shrink-0 place-items-center rounded-[8px] border font-mono text-sm font-bold ";

  if (showCorrect) {
    card += "border-success bg-success/10 text-ink";
    badge += "border-success bg-success text-white";
  } else if (showWrong) {
    card += "border-danger bg-danger/10 text-ink";
    badge += "border-danger bg-danger text-white";
  } else if (answered) {
    card += "border-line text-faint";
    badge += "border-line text-faint";
  } else if (showChosen) {
    // Accent, not green: this says "this is your answer", never "this answer is right".
    card += "border-accent bg-accent-soft text-ink";
    badge += "border-accent bg-accent text-white";
  } else {
    card += "border-line-strong bg-surface text-ink hover:border-accent hover:bg-accent-soft";
    badge += "border-line-strong text-muted";
  }

  return (
    <button type="button" disabled={answered} onClick={onSelect} className={card}>
      <span className={badge}>
        {showCorrect ? (
          <Icon name="check" size={15} />
        ) : showWrong ? (
          <Icon name="x" size={15} />
        ) : (
          String.fromCharCode(65 + index)
        )}
      </span>
      <span dir={textDirection(option)} className="nice-scroll max-h-28 min-w-0 overflow-y-auto break-words">
        <RichText text={option} />
      </span>
    </button>
  );
}
