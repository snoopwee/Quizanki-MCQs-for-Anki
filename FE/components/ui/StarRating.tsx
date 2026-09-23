"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icons";
import { formatAverage, ratingCaption, ratingLabel, starFills, STARS } from "@/lib/ratingDisplay";

/**
 * A deck's public score: five stars, the number, and how many people rated it.
 *
 * The stars are `aria-hidden` and the whole thing carries one readable label — five separate star
 * glyphs announced one by one tell a screen reader nothing.
 */
export function StarRating({
  average,
  count,
  size = 14,
  showCaption = true,
}: {
  average: number;
  count: number;
  size?: number;
  /** Off on a dense deck card, where the number alone is enough. */
  showCaption?: boolean;
}) {
  const rated = count > 0;

  return (
    <span
      className="inline-flex items-center gap-1.5"
      title={ratingLabel(average, count)}
      aria-label={ratingLabel(average, count)}
      role="img"
    >
      <span aria-hidden className="inline-flex items-center gap-0.5 text-warning">
        {starFills(rated ? average : 0).map((fill, i) => (
          <Star key={i} fill={fill} size={size} />
        ))}
      </span>
      {rated ? (
        <span aria-hidden className="font-mono text-xs text-muted">
          {formatAverage(average)}
          {showCaption && <span className="text-faint"> · {ratingCaption(count)}</span>}
        </span>
      ) : (
        showCaption && (
          <span aria-hidden className="font-mono text-xs text-faint">
            {ratingCaption(count)}
          </span>
        )
      )}
    </span>
  );
}

/**
 * One star. A half is the empty outline with a filled copy clipped to half its width on top —
 * the icon set is stroke-based, so `fill-current` is what turns an outline solid.
 */
function Star({ fill, size }: { fill: "full" | "half" | "empty"; size: number }) {
  if (fill === "full") {
    return <Icon name="star" size={size} className="fill-current" />;
  }
  if (fill === "empty") {
    return <Icon name="star" size={size} className="text-line-strong" />;
  }
  return (
    <span className="relative inline-flex shrink-0">
      <Icon name="star" size={size} className="text-line-strong" />
      <span className="absolute inset-0 w-1/2 overflow-hidden">
        <Icon name="star" size={size} className="fill-current" />
      </span>
    </span>
  );
}

/**
 * The rating control: five buttons that commit on click. Hovering previews the score you are about
 * to give, so a mis-click is visible before it happens.
 */
export function StarPicker({
  value,
  onPick,
  disabled = false,
  size = 24,
}: {
  /** The caller's current rating, or null when they haven't rated yet. */
  value: number | null;
  onPick: (stars: number) => void;
  disabled?: boolean;
  size?: number;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const shown = hovered ?? value ?? 0;

  return (
    <span className="inline-flex items-center gap-1" onMouseLeave={() => setHovered(null)}>
      {Array.from({ length: STARS }, (_, i) => i + 1).map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          aria-label={`${star} ${star === 1 ? "star" : "stars"}`}
          aria-pressed={value === star}
          onMouseEnter={() => setHovered(star)}
          onFocus={() => setHovered(star)}
          onBlur={() => setHovered(null)}
          onClick={() => onPick(star)}
          className={`focus-ring rounded-full p-0.5 transition disabled:cursor-not-allowed disabled:opacity-50 ${
            star <= shown ? "text-warning" : "text-line-strong hover:text-warning/60"
          }`}
        >
          <Icon name="star" size={size} className={star <= shown ? "fill-current" : ""} />
        </button>
      ))}
    </span>
  );
}
