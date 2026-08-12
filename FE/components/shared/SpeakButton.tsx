"use client";

import { useSyncExternalStore } from "react";
import { useSpeech } from "@/hooks/useSpeech";
import { isClipPlaying, playClip, subscribeClip } from "@/lib/audioClip";

// Speaker button that reads `text` aloud via the Web Speech API. The language is
// auto-detected per segment (a card can mix languages — see lib/ttsLang), so this
// component just hands the raw text to the speech layer. Like StarButton it stops
// click propagation so it can sit inside the flip-card button without flipping it.
// Renders nothing when the browser has no speech support.
//
// Three states, surfaced via the shared "active" key/status:
//   idle → click → loading (spinner, awaiting the engine) → speaking (stop) → idle
//
// `id` must be unique among buttons that can speak at the same time — it's the key
// the shared active state toggles on. Pass `label` to render a wider pill button
// ("Listen"); omit it for a compact icon-only button.
//
// When `audioUrl` is set the button plays that stored clip instead of TTS (the
// real recording is preferred over synthesis), toggling play/stop on the shared
// single-clip player. In this mode the button renders even without speech support,
// since playing a file needs none.

type Size = "sm" | "md";

const ICON_SIZE: Record<Size, string> = {
  sm: "h-7 w-7 text-sm",
  md: "h-9 w-9 text-lg",
};

function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

export function SpeakButton({
  id,
  text,
  label,
  size = "md",
  lang = "",
  audioUrl,
}: {
  id: string;
  text: string;
  // When set, renders a labeled pill button (e.g. "Listen"); otherwise icon-only.
  label?: string;
  size?: Size;
  // Primary-language hint for this text (BCP-47 primary subtag, e.g. "ja"). Steers
  // TTS away from the ambiguous script default (bare kanji → Chinese). "" = auto.
  lang?: string;
  // When set, play this stored clip instead of synthesizing `text` (real
  // recording preferred). "" / undefined falls back to TTS.
  audioUrl?: string;
}) {
  const { supported, activeKey, activeStatus, toggle } = useSpeech();
  const clipMode = Boolean(audioUrl);
  const clipPlaying = useSyncExternalStore(
    subscribeClip,
    () => (audioUrl ? isClipPlaying(audioUrl) : false),
    () => false,
  );
  // TTS support only gates the TTS mode; a stored clip needs no speech engine.
  if (!clipMode && !supported) return null;

  const empty = text.trim().length === 0;
  const active = activeKey === id;
  const loading = !clipMode && active && activeStatus === "loading";
  const speaking = !clipMode && active && activeStatus === "speaking";
  const busy = clipMode ? clipPlaying : loading || speaking;
  // In clip mode there's always something to play, so the button is never disabled.
  const disabled = clipMode ? false : empty;

  const title = clipMode
    ? busy
      ? "Stop"
      : "Play audio"
    : empty
      ? "Nothing to read"
      : busy
        ? "Stop"
        : "Read aloud";

  const iconNode = loading ? (
    <Spinner className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
  ) : (
    <span aria-hidden>{busy ? "⏹" : "🔊"}</span>
  );

  const onClick = (e: React.MouseEvent) => {
    // Inside flip cards / clickable rows — don't let the toggle bubble.
    e.stopPropagation();
    e.preventDefault();
    if (clipMode) {
      playClip(audioUrl as string); // toggles play/stop on the shared player
    } else {
      toggle(id, text, lang);
    }
  };

  const common = {
    type: "button" as const,
    "aria-label": busy ? "Stop audio" : clipMode ? "Play audio" : "Read aloud",
    "aria-pressed": busy,
    title,
    disabled,
    onClick,
  };

  // Labeled pill variant.
  if (label) {
    return (
      <button
        {...common}
        className={`focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-40 ${
          busy
            ? "border-accent bg-accent-soft text-accent-ink"
            : "border-line-strong text-ink hover:border-accent hover:text-accent"
        }`}
      >
        {iconNode}
        <span>{loading ? "Loading…" : busy ? "Stop" : label}</span>
      </button>
    );
  }

  // Compact icon-only variant.
  return (
    <button
      {...common}
      className={`focus-ring inline-flex shrink-0 items-center justify-center rounded-full leading-none transition-colors disabled:opacity-40 ${
        ICON_SIZE[size]
      } ${busy ? "text-accent hover:opacity-80" : "text-faint hover:text-accent"}`}
    >
      {iconNode}
    </button>
  );
}
