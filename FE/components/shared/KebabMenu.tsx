"use client";

import { useEffect, useId, useRef, useState } from "react";

export interface KebabItem {
  label: string;
  onClick: () => void;
  // Renders the item in red — used for destructive actions like Delete.
  danger?: boolean;
}

// The "⋯" settings button used across decks and cards. Opens a small dropdown of
// actions; closes on outside click, Escape, or after an item is chosen. This is
// the single home for per-card / per-deck options (edit, delete, export, …).
export function KebabMenu({
  items,
  label = "Options",
  align = "right",
}: {
  items: KebabItem[];
  label?: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        className="rounded-md px-2 py-1 text-lg leading-none text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
      >
        ⋯
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          className={`absolute z-20 mt-1 min-w-36 overflow-hidden rounded-lg border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-800 dark:bg-neutral-950 ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
                item.danger
                  ? "text-red-600 dark:text-red-400"
                  : "text-neutral-700 dark:text-neutral-200"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
