// The project's audio player for card clips.
//
// Replaces a bare `<audio controls>`, whose chrome is painted by the browser
// (grey pill, system play glyph, system slider) and can't be themed — it read as
// a foreign widget dropped into the warm study-desk UI, next to our own
// stroke-drawn icon set. This is the same controls built from `Icon`, so the
// play/pause glyph matches every other icon on the card.
//
// The `<audio>` element itself is still what plays — only its UI is ours, so
// formats, buffering and autoplay policy behave exactly as before.
// `preload="none"` is kept from the original: a long list of cards must not fire
// a network request per clip, so the duration stays unknown until first play.

"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Icon } from "@/components/ui/icons";

const SIZES = {
  sm: { button: "h-7 w-7", icon: 13, text: "text-[11px]", gap: "gap-2" },
  md: { button: "h-10 w-10", icon: 16, text: "text-xs", gap: "gap-3" },
} as const;

// mm:ss, or an em-dash placeholder before the metadata has loaded.
function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "–:––";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function AudioPlayer({
  src,
  size = "md",
  className = "",
}: {
  src: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const s = SIZES[size];

  // A new clip (card change / swap) resets the transport.
  useEffect(() => {
    setPlaying(false);
    setCurrent(0);
    setDuration(0);
  }, [src]);

  function toggle() {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      void el.play().catch(() => setPlaying(false));
    } else {
      el.pause();
    }
  }

  function seek(e: React.ChangeEvent<HTMLInputElement>) {
    const el = audioRef.current;
    const next = Number(e.target.value);
    setCurrent(next);
    if (el) el.currentTime = next;
  }

  const known = duration > 0;

  return (
    // A tap on the player must never reach the card behind it — on the study face
    // that would flip the card mid-listen. Handled here so no caller can forget.
    <div
      onClick={(e: MouseEvent) => e.stopPropagation()}
      className={`flex items-center rounded-full border border-line-strong bg-surface-2 px-2 py-1.5 ${s.gap} ${className}`}
    >
      {/* Flat tinted glyph — the same treatment as SpeakButton / StarButton, which
          sit on the same card face. Deliberately NOT a filled + shadowed circle:
          `shadow-btn` and `bg-accent` belong to rectangular primary CTAs, and using
          them here made the control read as raised next to the flat stroke icons
          around it. One style across the UI. */}
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause audio" : "Play audio"}
        className={`focus-ring inline-flex shrink-0 items-center justify-center rounded-full leading-none text-accent transition-colors hover:opacity-80 ${s.button}`}
      >
        <Icon name={playing ? "pause" : "play"} size={s.icon} />
      </button>

      <input
        type="range"
        min={0}
        max={known ? duration : 1}
        step="any"
        value={current}
        onChange={seek}
        disabled={!known}
        aria-label="Seek"
        // `accent-accent` themes the native range track/thumb with the app's
        // terracotta — the one piece of native UI that IS themable.
        className="h-1 min-w-0 flex-1 cursor-pointer accent-accent disabled:cursor-default disabled:opacity-50"
      />

      <span className={`shrink-0 tabular-nums text-muted ${s.text}`}>
        {known ? `${formatTime(current)} / ${formatTime(duration)}` : formatTime(NaN)}
      </span>

      <audio
        ref={audioRef}
        src={src}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onEnded={() => {
          setPlaying(false);
          setCurrent(0);
        }}
        className="hidden"
      />
    </div>
  );
}
