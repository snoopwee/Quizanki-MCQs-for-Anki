// The project's dropdown. **Use this instead of a native `<select>` anywhere in
// the app** — a native select's option list is painted by the OS (stark
// system-blue highlight, system font, square corners) and cannot be styled, so it
// breaks the warm "study desk" palette every time it opens.
//
// Built as an ARIA combobox + listbox: focus stays on the trigger and the active
// option is announced via `aria-activedescendant`, which keeps full keyboard
// support (↑ ↓ Home End Enter Space Escape Tab) without managing roving focus.
//
// `FieldSelect` wraps this for the import/quiz field pickers; everything else
// should use it directly.

"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Icon } from "@/components/ui/icons";
import {
  MENU_ITEM,
  MENU_ITEM_ACTIVE,
  MENU_ITEM_IDLE,
  MENU_ITEM_SELECTED,
  MENU_SURFACE,
} from "@/components/ui/menu";

export type SelectOption<T extends string | number> = {
  value: T;
  label: string;
};

const SIZES = {
  sm: { trigger: "px-2 py-1.5 text-sm", chevron: 15 },
  md: { trigger: "px-3 py-2 text-sm", chevron: 16 },
} as const;

export function Select<T extends string | number>({
  value,
  options,
  onChange,
  ariaLabel,
  ariaLabelledBy,
  placeholder = "Select…",
  size = "md",
  align = "left",
  disabled = false,
  fullWidth = false,
  className = "",
}: {
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  /** Give one of these so the control is named for screen readers. */
  ariaLabel?: string;
  ariaLabelledBy?: string;
  placeholder?: string;
  size?: keyof typeof SIZES;
  /** Right-align the menu when the trigger sits at the right edge of a row. */
  align?: "left" | "right";
  disabled?: boolean;
  fullWidth?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const baseId = useId();
  const listId = `${baseId}-list`;
  const optionId = (i: number) => `${baseId}-opt-${i}`;
  const s = SIZES[size];

  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const selected = options[selectedIndex];

  function openMenu() {
    if (disabled) return;
    setHighlight(selectedIndex);
    setOpen(true);
  }

  function choose(i: number) {
    const o = options[i];
    if (o !== undefined) onChange(o.value);
    setOpen(false);
  }

  // Close on outside click; Escape and the rest of the keyboard are handled on the
  // trigger, which keeps focus there throughout.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  // Keep the active option in view while arrowing through a long list.
  useEffect(() => {
    if (!open) return;
    document.getElementById(optionId(highlight))?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, highlight]);

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        setOpen(false);
        break;
      case "ArrowDown":
        e.preventDefault();
        setHighlight((h) => Math.min(options.length - 1, h + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlight((h) => Math.max(0, h - 1));
        break;
      case "Home":
        e.preventDefault();
        setHighlight(0);
        break;
      case "End":
        e.preventDefault();
        setHighlight(options.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        choose(highlight);
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  }

  return (
    <div ref={rootRef} className={`relative ${fullWidth ? "w-full" : "shrink-0"} ${className}`}>
      <button
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? optionId(highlight) : undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
        className={`focus-ring flex w-full items-center justify-between gap-2 rounded-input border bg-surface-2 text-left font-medium text-ink transition disabled:opacity-50 ${
          s.trigger
        } ${open ? "border-accent" : "border-line-strong hover:border-accent"}`}
      >
        <span className="relative block min-w-0 flex-1 text-left">
          {/* Width sizer: the trigger is as wide as the LONGEST option, so the menu
              (`w-full`) is exactly the trigger's width — a dropdown whose panel is
              wider than the button it hangs off reads as two mismatched elements.
              Zero height, so it costs no vertical space.
              `font-semibold` deliberately: the SELECTED row renders semibold while
              the trigger renders medium, and bold type is wider (measured ~2px on
              "All mastery"), so sizing at medium left the selected label a hair short
              and it truncated in the menu only. Reserve the widest weight a label can
              take, not the one the trigger happens to use. */}
          <span
            aria-hidden
            className="pointer-events-none block h-0 overflow-hidden font-semibold"
          >
            {options.map((o) => (
              // pr-0.5 (2px) covers the menu panel's left+right 1px borders, which
              // make its content box that much narrower than the trigger's.
              <span key={String(o.value)} className="block whitespace-nowrap pr-0.5">
                {o.label}
              </span>
            ))}
          </span>
          <span className="block truncate">{selected ? selected.label : placeholder}</span>
        </span>
        <Icon
          name="chevronDown"
          size={s.chevron}
          className={`shrink-0 transition-transform duration-150 ${
            open ? "rotate-180 text-accent" : "text-faint"
          }`}
        />
      </button>

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          // `w-full`: the panel is exactly as wide as its trigger. The trigger is
          // already sized to the longest option (see the sizer above), so nothing
          // truncates and the two edges line up.
          className={`${MENU_SURFACE} w-full ${align === "right" ? "right-0" : "left-0"}`}
        >
          {options.map((o, i) => {
            const isSelected = o.value === value;
            const active = i === highlight;
            return (
              <li
                key={String(o.value)}
                id={optionId(i)}
                role="option"
                aria-selected={isSelected}
                onClick={() => choose(i)}
                onMouseEnter={() => setHighlight(i)}
                className={`${MENU_ITEM} cursor-pointer justify-between gap-2 ${
                  isSelected ? MENU_ITEM_SELECTED : active ? MENU_ITEM_ACTIVE : MENU_ITEM_IDLE
                }`}
              >
                <span className="truncate">{o.label}</span>
                {/* 16px to match the trigger's chevron, so the label gets the same
                    width in both and never truncates in only one of them. */}
                {isSelected && <Icon name="check" size={16} className="shrink-0 text-accent" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
