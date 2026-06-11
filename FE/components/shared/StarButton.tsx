"use client";

// Toggle a flashcard's "star" (focus) flag. Used on the flashcard study screen,
// each preview row, and mid-quiz. Stops click propagation so starring a card
// inside the flip-card button (or a clickable row) doesn't also flip/navigate.

type Size = "sm" | "md";

const SIZE: Record<Size, string> = {
  sm: "h-7 w-7 text-base",
  md: "h-9 w-9 text-xl",
};

export function StarButton({
  starred,
  onToggle,
  size = "md",
  busy = false,
}: {
  starred: boolean;
  onToggle: (next: boolean) => void;
  size?: Size;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={starred}
      aria-label={starred ? "Unstar this card" : "Star this card"}
      title={starred ? "Starred — click to remove" : "Star to focus on this card"}
      disabled={busy}
      onClick={(e) => {
        // Inside flip cards / clickable rows — don't let the toggle bubble.
        e.stopPropagation();
        e.preventDefault();
        onToggle(!starred);
      }}
      className={`focus-ring inline-flex shrink-0 items-center justify-center rounded-full leading-none transition-colors disabled:opacity-50 ${
        SIZE[size]
      } ${starred ? "text-warning hover:opacity-80" : "text-faint hover:text-warning"}`}
    >
      <span aria-hidden>{starred ? "★" : "☆"}</span>
    </button>
  );
}
