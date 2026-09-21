import { OptionButton } from "@/components/quiz/OptionButton";

// Multiple choice: the shuffled options as lettered A–D buttons, one column on phones and
// two from `sm`. Reports the tapped option; the caller grades and records it.
export function McqChoices({
  options,
  correct,
  selected,
  answered,
  onSelect,
}: {
  options: string[];
  correct: string;
  selected: string | null;
  answered: boolean;
  onSelect: (option: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {options.map((option, idx) => (
        <OptionButton
          key={option}
          option={option}
          index={idx}
          answered={answered}
          isCorrect={option === correct}
          isSelected={option === selected}
          onSelect={() => onSelect(option)}
        />
      ))}
    </div>
  );
}
