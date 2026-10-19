// The one decision inside `Select` that is easy to get wrong and impossible to see: which option,
// if any, the current value refers to. Pulled out as a pure function so it can be tested — the
// component suite is node-environment and renders nothing.

export interface OptionLike<T> {
  value: T;
  label: string;
}

/**
 * The option matching `value`, or `undefined` when nothing matches.
 *
 * <p><b>`undefined` is the point.</b> It is what tells the trigger to render its placeholder. The
 * tempting shorthand — `options[Math.max(0, findIndex(...))]` — silently turns "no match" into
 * "the first option", which makes the placeholder unreachable whenever the list is non-empty and
 * leaves an unset picker claiming a choice the user never made.
 */
export function selectedOption<T>(
  options: readonly OptionLike<T>[],
  value: T | undefined,
): OptionLike<T> | undefined {
  const i = options.findIndex((o) => o.value === value);
  return i >= 0 ? options[i] : undefined;
}

/**
 * Where the menu's highlight starts when it opens: on the current choice, or at the top when there
 * isn't one. Here clamping to 0 IS correct — a menu always has to highlight something.
 */
export function initialHighlight<T>(
  options: readonly OptionLike<T>[],
  value: T | undefined,
): number {
  return Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
}
