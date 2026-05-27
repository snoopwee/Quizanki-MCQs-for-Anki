export function OptionButton({
  option,
  answered,
  isCorrect,
  isSelected,
  onSelect,
}: {
  option: string;
  answered: boolean;
  isCorrect: boolean;
  isSelected: boolean;
  onSelect: () => void;
}) {
  let className =
    "nice-scroll flex h-full min-h-0 w-full items-center justify-center overflow-y-auto rounded-md border px-4 py-4 text-center text-sm transition-colors break-words ";

  if (!answered) {
    className +=
      "border-neutral-300 hover:border-neutral-900 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:border-neutral-200 dark:hover:bg-neutral-900";
  } else if (isCorrect) {
    className +=
      "border-green-500 bg-green-50 text-green-800 dark:border-green-600 dark:bg-green-900/30 dark:text-green-300";
  } else if (isSelected) {
    className +=
      "border-red-500 bg-red-50 text-red-800 dark:border-red-600 dark:bg-red-900/30 dark:text-red-300";
  } else {
    className += "border-neutral-200 text-neutral-400 dark:border-neutral-800 dark:text-neutral-600";
  }

  return (
    <button type="button" disabled={answered} onClick={onSelect} className={className}>
      {option}
    </button>
  );
}
