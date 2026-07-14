"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Icon } from "@/components/ui/icons";

// A labelled field dropdown with a sample value preview. Shared by the paste-
// import field confirmation (FieldDetector) and the .apkg trial setup
// (ApkgQuizSetup) so both pick question/answer fields the same way.
//
// Built as a custom listbox rather than a native <select>: the OS-painted
// option list (stark system-blue highlight) clashed with the warm study-desk
// palette and can't be styled. This keeps the open menu on-brand — terracotta
// selection, cream surface, rounded rows — while staying keyboard-accessible.
export function FieldSelect({
  label,
  value,
  fields,
  sample,
  onChange,
}: {
  label: string;
  value: string;
  fields: string[];
  sample: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const baseId = useId();
  const listId = `${baseId}-list`;
  const labelId = `${baseId}-label`;
  const optionId = (i: number) => `${baseId}-opt-${i}`;

  const selectedIndex = Math.max(0, fields.indexOf(value));

  function openMenu() {
    setHighlight(selectedIndex);
    setOpen(true);
  }

  function choose(i: number) {
    const f = fields[i];
    if (f !== undefined) onChange(f);
    setOpen(false);
  }

  // Close on outside click. Escape/keyboard is handled on the trigger itself,
  // which keeps focus throughout (aria-activedescendant pattern).
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  // Keep the active option in view as the user arrows through a long field list.
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
        setHighlight((h) => Math.min(fields.length - 1, h + 1));
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
        setHighlight(fields.length - 1);
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
    <div className="space-y-1.5">
      <label id={labelId} className="text-sm font-medium text-ink">
        {label}
      </label>
      <div ref={rootRef} className="relative">
        <button
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-activedescendant={open ? optionId(highlight) : undefined}
          aria-labelledby={labelId}
          onClick={() => (open ? setOpen(false) : openMenu())}
          onKeyDown={onKeyDown}
          className={`focus-ring flex w-full items-center justify-between gap-2 rounded-input border bg-surface-2 px-3 py-2 text-left text-sm font-medium text-ink transition ${
            open ? "border-accent" : "border-line-strong hover:border-accent"
          }`}
        >
          <span className="truncate">{value || "Select a field"}</span>
          <Icon
            name="chevronDown"
            size={16}
            className={`shrink-0 transition-transform duration-150 ${
              open ? "rotate-180 text-accent" : "text-faint"
            }`}
          />
        </button>

        {open && (
          <ul
            id={listId}
            role="listbox"
            aria-labelledby={labelId}
            className="nice-scroll absolute left-0 right-0 z-30 mt-1.5 max-h-60 overflow-y-auto rounded-card border border-line bg-surface p-1 shadow-card"
          >
            {fields.map((f, i) => {
              const selected = f === value;
              const active = i === highlight;
              return (
                <li
                  key={f}
                  id={optionId(i)}
                  role="option"
                  aria-selected={selected}
                  onClick={() => choose(i)}
                  onMouseEnter={() => setHighlight(i)}
                  className={`flex cursor-pointer items-center justify-between gap-2 rounded-[8px] px-2.5 py-2 text-sm transition ${
                    selected
                      ? "bg-accent-soft font-semibold text-accent-ink"
                      : active
                        ? "bg-surface-2 text-ink"
                        : "text-ink"
                  }`}
                >
                  <span className="truncate">{f}</span>
                  {selected && <Icon name="check" size={15} className="shrink-0 text-accent" />}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <p className="truncate text-xs text-faint" title={sample}>
        e.g. {sample}
      </p>
    </div>
  );
}
