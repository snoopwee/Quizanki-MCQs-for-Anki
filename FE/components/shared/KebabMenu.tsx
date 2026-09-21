"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/ui/icons";
import { IconButton, iconButtonIconSize, type IconButtonSize } from "@/components/ui/IconButton";
import {
  MENU_ITEM,
  MENU_ITEM_DANGER,
  MENU_ITEM_HOVER,
  MENU_ITEM_IDLE,
  MENU_SURFACE,
} from "@/components/ui/menu";

export interface KebabItem {
  label: string;
  onClick: () => void;
  // Leading icon. Give every item in a menu one or give none of them one — a
  // mixed menu leaves some labels indented and some not.
  icon?: IconName;
  // Keep `label` SHORT — ideally one word. The menu already names its subject (a
  // deck's ⋯ menu is about that deck), so "Edit flashcards" / "Delete deck" only
  // repeat it: use "Edit", "Delete". Rows never wrap (the list is nowrap and sizes
  // to its longest label), so a long label doesn't break the layout — it just
  // makes the menu wide. Spend the width only where it carries meaning the short
  // form would lose, e.g. "Save to Home" names a destination.
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
  size = "md",
  bordered = false,
}: {
  items: KebabItem[];
  label?: string;
  align?: "left" | "right";
  size?: IconButtonSize;
  /** Only when this sits in a cluster of peer icon actions. */
  bordered?: boolean;
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
      {/* A ⋯ menu is usually a LONE control (a deck header's options), so it is
          unbordered by default — the outline is for a cluster of peer actions.
          Pass `bordered` when it genuinely sits in one. */}
      <IconButton
        label={label}
        size={size}
        bordered={bordered}
        ariaHasPopup="menu"
        ariaExpanded={open}
        ariaControls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
        className="text-muted hover:text-ink"
      >
        <Icon name="dots" size={iconButtonIconSize(size)} />
      </IconButton>
      {open && (
        <div
          id={menuId}
          role="menu"
          // Same surface as the Select listbox (see components/ui/menu.ts) — one
          // menu look across the app. `w-max` sizes it to its longest label rather
          // than shrink-to-fitting against the icon button it hangs off, so a row
          // never wraps onto a second line.
          className={`${MENU_SURFACE} w-max min-w-36 ${align === "right" ? "right-0" : "left-0"}`}
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
              className={`${MENU_ITEM} ${MENU_ITEM_HOVER} cursor-pointer gap-2.5 ${
                item.danger ? MENU_ITEM_DANGER : MENU_ITEM_IDLE
              }`}
            >
              {item.icon && (
                <Icon
                  name={item.icon}
                  size={15}
                  className={`shrink-0 ${item.danger ? "" : "text-faint"}`}
                />
              )}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
