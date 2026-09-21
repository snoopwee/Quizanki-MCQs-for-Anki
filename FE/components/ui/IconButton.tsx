// The project's icon-only button.
//
// **Why this exists:** icon glyphs have different intrinsic widths (a speaker is
// wide, a star is square, an ellipsis is wide and flat). Rendered as bare glyphs
// they produce ragged, uneven spacing even when the gap between them is identical
// — the row reads as unbalanced. Normalising every one into a container of the
// SAME size fixes the rhythm: the eye tracks the containers, not the glyphs.
//
// Before this existed, three peer controls on one card row each invented their own
// box — SpeakButton `h-9 w-9` circle, StarButton `h-9 w-9` circle, KebabMenu a
// `px-2 py-1.5` rounded RECTANGLE — so they were three different shapes and widths
// sitting side by side.
//
// `bordered` (the default) draws the container, which is what gives a cluster of
// peer actions its even beat. Turn it off for a lone control that isn't part of a
// group (a modal close, a toast dismiss) — it keeps the same size and shape, just
// without the outline.

"use client";

import type { ReactNode } from "react";

export const ICON_BUTTON_SIZES = {
  sm: { box: "h-7 w-7", icon: 14 },
  md: { box: "h-9 w-9", icon: 17 },
} as const;

export type IconButtonSize = keyof typeof ICON_BUTTON_SIZES;

/** Icon px that fills each size correctly — pass to `<Icon size={…}>`. */
export function iconButtonIconSize(size: IconButtonSize): number {
  return ICON_BUTTON_SIZES[size].icon;
}

export function IconButton({
  label,
  onClick,
  children,
  size = "md",
  bordered = true,
  disabled = false,
  className = "",
  title,
  ariaPressed,
  ariaHasPopup,
  ariaExpanded,
  ariaControls,
}: {
  /** Accessible name; also the tooltip unless `title` overrides it. */
  label: string;
  onClick: (e: React.MouseEvent) => void;
  /** The glyph — an `<Icon />`, or a spinner while busy. */
  children: ReactNode;
  size?: IconButtonSize;
  bordered?: boolean;
  disabled?: boolean;
  /** Colour/state classes only — never size or shape. */
  className?: string;
  title?: string;
  ariaPressed?: boolean;
  ariaHasPopup?: "menu" | "listbox" | "dialog" | "true";
  ariaExpanded?: boolean;
  ariaControls?: string;
}) {
  const s = ICON_BUTTON_SIZES[size];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={title ?? label}
      aria-pressed={ariaPressed}
      aria-haspopup={ariaHasPopup}
      aria-expanded={ariaExpanded}
      aria-controls={ariaControls}
      className={`focus-ring inline-flex shrink-0 items-center justify-center rounded-full leading-none transition-colors disabled:opacity-40 ${
        s.box
      } ${bordered ? "border border-line hover:border-accent" : ""} ${className}`}
    >
      {children}
    </button>
  );
}
