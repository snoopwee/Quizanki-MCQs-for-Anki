"use client";

import { useEffect, useState } from "react";

// The user's avatar: their uploaded photo when present, otherwise the initials
// chip. Size/typography come from `className` so the same component serves the
// 32px sidebar chip and the 80px profile preview. Falls back to initials if the
// image URL 404s (e.g. the object was removed out from under a stale metadata URL).
export function Avatar({
  url,
  initials,
  className = "",
  title,
}: {
  url?: string | null;
  initials: string;
  /** Controls the box + text size, e.g. "h-16 w-16 text-xl". */
  className?: string;
  title?: string;
}) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [url]);

  const showImage = Boolean(url) && !broken;

  return (
    <span
      aria-hidden
      title={title}
      className={`grid shrink-0 place-items-center overflow-hidden rounded-full bg-accent-soft font-display font-bold text-accent-ink ${className}`}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- avatar URLs are arbitrary Supabase Storage hosts; next/image would need remotePatterns config
        <img
          src={url as string}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        initials
      )}
    </span>
  );
}
