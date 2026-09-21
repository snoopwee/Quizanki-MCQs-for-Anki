// Shared look for every dropdown/popover list in the app: the `Select` listbox and
// the `KebabMenu` action menu both render with these, so a choice menu looks the
// same wherever it opens.
//
// **This is THE menu style — use it for any new dropdown.** The shape is: a
// rounded-card surface with 1px padding, and rows inset inside it with their own
// smaller radius (so a hovered/selected row reads as a chip within the panel rather
// than a full-bleed band with square corners).
//
// Row padding is `px-2` on top of the surface's `p-1`, which puts a row's text at
// the same distance from the panel's edge as the trigger's text is from its own —
// so the label doesn't shift sideways when the menu opens.

/** The floating panel. Callers add their own width + placement. */
export const MENU_SURFACE =
  "nice-scroll absolute z-30 mt-1.5 max-h-60 overflow-y-auto overflow-x-hidden rounded-card border border-line bg-surface p-1 shadow-card";

/**
 * One row. Callers add the tone (below), their own `gap-*`, and any row-specific
 * layout. Gap is deliberately NOT set here: a Select row's trailing check must
 * occupy exactly the same width as the trigger's chevron or its label truncates
 * while the trigger's doesn't — and two conflicting `gap-*` utilities can't be
 * resolved by class order.
 *
 * `px-2` on top of the surface's `p-1` puts a row's text 12px from the panel edge,
 * matching a `md` trigger's `px-3`, so the label doesn't shift when the menu opens.
 */
export const MENU_ITEM =
  "flex w-full items-center whitespace-nowrap rounded-[8px] px-2 py-2 text-left text-sm transition";

/**
 * Hover tone for a row the user can click. Written out in full (not composed from
 * MENU_ITEM_ACTIVE) because Tailwind only generates classes it finds as LITERAL
 * strings in the source — a `hover:${…}` built at runtime is silently dropped.
 */
export const MENU_ITEM_HOVER = "hover:bg-surface-2";

/**
 * Row tones. `selected` is the chosen value; `active` is keyboard/hover focus.
 *
 * ⚠ The weight here (`font-semibold`) is the WIDEST a row's label can render. The
 * `Select` trigger's hidden width sizer renders at this same weight so the panel
 * reserves enough room — bold type is wider (~2px on an 11-character label), and
 * sizing at the trigger's own `font-medium` left the selected label 0.01px short,
 * which the browser rounds up into an ellipsis. **If you change this weight, change
 * the sizer's weight in Select.tsx to match.**
 */
export const MENU_ITEM_SELECTED = "bg-accent-soft font-semibold text-accent-ink";
export const MENU_ITEM_ACTIVE = "bg-surface-2 text-ink";
export const MENU_ITEM_IDLE = "text-ink";
/** A destructive action (Delete). Keeps the same shape, just red. */
export const MENU_ITEM_DANGER = "text-danger";
