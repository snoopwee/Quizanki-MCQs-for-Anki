"use client";

import { useEffect, type ReactNode } from "react";
import { Icon } from "@/components/ui/icons";
import { IconButton, iconButtonIconSize } from "@/components/ui/IconButton";

// A simple centered modal: closes on backdrop click or Escape. The overlay
// scrolls so a tall panel (e.g. the quiz settings form) stays reachable.
export function Modal({
  title,
  onClose,
  children,
}: {
  title?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="nice-scroll fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 backdrop-blur-sm sm:p-8"
      onClick={onClose}
    >
      <div
        className="my-4 w-full max-w-2xl rounded-card border border-line bg-surface p-6 shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          {title && <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>}
          {/* A lone control, so no border — but the same circle and size as every
              other icon button, per DESIGN_SYSTEM → Alignment. */}
          <IconButton
            label="Close"
            onClick={onClose}
            bordered={false}
            className="ml-auto text-muted hover:bg-surface-2 hover:text-ink"
          >
            <Icon name="x" size={iconButtonIconSize("md")} />
          </IconButton>
        </div>
        {children}
      </div>
    </div>
  );
}
