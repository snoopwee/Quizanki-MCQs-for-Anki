"use client";

import { Icon } from "@/components/ui/icons";
import { IconButton, iconButtonIconSize } from "@/components/ui/IconButton";

// Toggle a flashcard's "star" (focus) flag. Used on the flashcard study screen,
// each preview row, and mid-quiz. Stops click propagation so starring a card
// inside the flip-card button (or a clickable row) doesn't also flip/navigate.
//
// Draws the shared stroke `star` icon, NOT the "★"/"☆" text glyphs it used to:
// those render in the system font as a solid shape with its own weight, which
// read as a different icon style sitting right beside the stroke-drawn speaker
// and play controls on the same card. Starred simply fills the same outline.

type Size = "sm" | "md";

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
    <IconButton
      label={starred ? "Unstar this card" : "Star this card"}
      title={starred ? "Starred — click to remove" : "Star to focus on this card"}
      ariaPressed={starred}
      disabled={busy}
      size={size}
      onClick={(e) => {
        // Inside flip cards / clickable rows — don't let the toggle bubble.
        e.stopPropagation();
        e.preventDefault();
        onToggle(!starred);
      }}
      className={starred ? "text-warning hover:opacity-80" : "text-faint hover:text-warning"}
    >
      {/* Same outline either way; `fill` is what marks it starred. */}
      <Icon name="star" size={iconButtonIconSize(size)} fill={starred ? "currentColor" : "none"} />
    </IconButton>
  );
}
