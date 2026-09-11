// Full-screen viewer for a card image, plus the clickable thumbnail that opens it.
//
// Card pictures are shown small wherever they appear (a row in "Cards in this deck"
// stays scannable, a study face leaves room for the text), which is no good for a
// diagram you actually need to read. Clicking any card image opens it here at full
// size, with real zoom on top.
//
// Zoom is done by setting the image's WIDTH from its natural width rather than with
// a CSS transform: a transform paints outside the box without growing it, so the
// magnified edges become unreachable. Width participates in layout, so the wrapper
// simply overflows and scrolls, and panning a zoomed diagram just works.

"use client";

import { useCallback, useEffect, useRef, useState, type Ref } from "react";
import { Icon } from "@/components/ui/icons";

// 1 = fit to the screen. Above that, a multiple of the image's natural pixel size.
const ZOOM_STEPS = [1, 1.5, 2, 3] as const;

export function ImageLightbox({ url, onClose }: { url: string; onClose: () => void }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [naturalWidth, setNaturalWidth] = useState(0);
  const closeRef = useRef<HTMLButtonElement>(null);
  const scale = ZOOM_STEPS[stepIndex];
  const zoomed = scale !== 1;

  const zoomBy = useCallback((delta: number) => {
    setStepIndex((i) => Math.min(ZOOM_STEPS.length - 1, Math.max(0, i + delta)));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "+" || e.key === "=") zoomBy(1);
      else if (e.key === "-") zoomBy(-1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, zoomBy]);

  // Move focus into the overlay so Escape/Tab act on it, not on whatever was
  // behind it (in the study view, that's the card — Space there would flip it).
  useEffect(() => closeRef.current?.focus(), []);

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-ink/80 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Card image"
    >
      <div
        className="flex shrink-0 items-center justify-end gap-1 p-3"
        onClick={(e) => e.stopPropagation()}
      >
        <ToolbarButton
          label="Zoom out"
          disabled={stepIndex === 0}
          onClick={() => zoomBy(-1)}
          icon="minimize"
        />
        <span className="min-w-14 select-none text-center text-sm font-medium tabular-nums text-white/80">
          {zoomed ? `${Math.round(scale * 100)}%` : "Fit"}
        </span>
        <ToolbarButton
          label="Zoom in"
          disabled={stepIndex === ZOOM_STEPS.length - 1}
          onClick={() => zoomBy(1)}
          icon="expand"
        />
        <ToolbarButton label="Close" onClick={onClose} icon="x" ref={closeRef} />
      </div>

      {/* Scrolls once the image outgrows the viewport. The inner `inline-flex`
          shrink-wraps the image but is at least as big as the viewport, so the
          image is centred while it fits and, once it doesn't, the wrapper grows
          with it instead of centring it and clipping the top/left edge (which is
          what a plain centred flex/grid container does to overflowing content). */}
      <div className="nice-scroll flex-1 overflow-auto" onClick={onClose}>
        <div className="inline-flex min-h-full min-w-full items-center justify-center p-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary Supabase Storage host; next/image would need remotePatterns config */}
          <img
            src={url}
            alt=""
            onLoad={(e) => setNaturalWidth(e.currentTarget.naturalWidth)}
            onClick={(e) => {
              e.stopPropagation();
              // Click toggles between fit and a useful magnification.
              setStepIndex((i) => (i === 0 ? 2 : 0));
            }}
            // Fit is sized against the viewport, not the parent: the parent is
            // shrink-wrapped around this image, so a percentage max-height here
            // would be circular.
            className={
              zoomed
                ? "max-w-none cursor-zoom-out"
                : "max-h-[82vh] max-w-[92vw] object-contain cursor-zoom-in"
            }
            style={zoomed && naturalWidth ? { width: naturalWidth * scale } : undefined}
          />
        </div>
      </div>
    </div>
  );
}

function ToolbarButton({
  label,
  icon,
  onClick,
  disabled = false,
  ref,
}: {
  label: string;
  icon: "expand" | "minimize" | "x";
  onClick: () => void;
  disabled?: boolean;
  ref?: Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="focus-ring grid h-9 w-9 place-items-center rounded-input text-white/80 transition hover:bg-white/15 hover:text-white disabled:pointer-events-none disabled:opacity-40"
    >
      <Icon name={icon} size={18} />
    </button>
  );
}

/**
 * A card image that opens in the lightbox when clicked. `stopPropagation` on the
 * click matters on the study screen, where the image sits on a card that flips
 * when you click it.
 */
export function ZoomableImage({ url, className }: { url: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label="View image full size"
        className="focus-ring block cursor-zoom-in rounded-input"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary Supabase Storage host; next/image would need remotePatterns config */}
        <img src={url} alt="" className={className} />
      </button>
      {open && <ImageLightbox url={url} onClose={() => setOpen(false)} />}
    </>
  );
}
