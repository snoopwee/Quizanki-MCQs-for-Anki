import { Icon, type IconName } from "@/components/ui/icons";
import { ALL_QUESTION_KINDS, type QuestionKind } from "@/lib/questionTypes";

// The question-format picker (Multiple choice / True-false / Written) shared by the quiz
// setup and Learn settings: one toggle chip per format, three columns from `sm`. The
// caller owns the set — use `toggleQuestionKind` so it keeps canonical order and never
// empties.
export function QuestionTypeChips({
  enabled,
  onToggle,
}: {
  enabled: QuestionKind[];
  onToggle: (kind: QuestionKind) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
      {ALL_QUESTION_KINDS.map((kind) => (
        <QTypeChip
          key={kind}
          icon={KIND_META[kind].icon}
          label={KIND_META[kind].label}
          on={enabled.includes(kind)}
          onClick={() => onToggle(kind)}
        />
      ))}
    </div>
  );
}

// Icon + label for each question format, in canonical order.
const KIND_META: Record<QuestionKind, { icon: IconName; label: string }> = {
  mcq: { icon: "clipboard", label: "Multiple choice" },
  truefalse: { icon: "check", label: "True / false" },
  written: { icon: "pencil", label: "Written" },
};

// A question-format toggle. `on` shows the accent fill + a filled checkbox; off
// is a plain, clickable chip with an empty checkbox.
function QTypeChip({
  icon,
  label,
  on,
  onClick,
}: {
  icon: IconName;
  label: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`focus-ring flex items-center gap-2.5 rounded-card border px-3.5 py-3 text-left transition ${
        on ? "border-accent bg-accent-soft" : "border-line bg-surface-2 hover:border-line-strong"
      }`}
    >
      <span className={on ? "text-accent-ink" : "text-faint"}>
        <Icon name={icon} size={18} />
      </span>
      <span className={`text-sm font-semibold ${on ? "text-ink" : "text-muted"}`}>{label}</span>
      <span className="ml-auto">
        {on ? (
          <span className="grid h-[18px] w-[18px] place-items-center rounded-[6px] bg-accent text-white">
            <Icon name="check" size={12} />
          </span>
        ) : (
          <span className="block h-[18px] w-[18px] rounded-[6px] border border-line-strong" />
        )}
      </span>
    </button>
  );
}
