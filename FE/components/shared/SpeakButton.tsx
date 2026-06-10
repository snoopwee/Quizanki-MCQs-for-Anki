"use client";

import { useSpeech } from "@/hooks/useSpeech";

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
}: {
  id: string;
  text: string;
  // When set, renders a labeled pill button (e.g. "Listen"); otherwise icon-only.
  label?: string;
  size?: Size;
}) {
  const { supported, activeKey, activeStatus, toggle } = useSpeech();
  if (!supported) return null;

  const empty = text.trim().length === 0;
  const active = activeKey === id;
  const loading = active && activeStatus === "loading";
  const speaking = active && activeStatus === "speaking";
  const busy = loading || speaking;

  const title = empty ? "Nothing to read" : busy ? "Stop" : "Read aloud";

  const iconNode = loading ? (
    <Spinner className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} />
  ) : (
    <span aria-hidden>{speaking ? "⏹" : "🔊"}</span>
  );

  const onClick = (e: React.MouseEvent) => {
    // Inside flip cards / clickable rows — don't let the toggle bubble.
    e.stopPropagation();
    e.preventDefault();
    toggle(id, text);
  };

  const common = {
    type: "button" as const,
    "aria-label": busy ? "Stop audio" : "Read aloud",
    "aria-pressed": busy,
    title,
    disabled: empty,
    onClick,
  };

  // Labeled pill variant.
  if (label) {
    return (
      <button
        {...common}
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-40 ${
          busy
            ? "border-sky-400 text-sky-600 dark:border-sky-500 dark:text-sky-400"
            : "border-neutral-300 text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"
        }`}
      >
        {iconNode}
        <span>{loading ? "Loading…" : speaking ? "Stop" : label}</span>
      </button>
    );
  }

  // Compact icon-only variant.
  return (
    <button
      {...common}
      className={`inline-flex shrink-0 items-center justify-center rounded-full leading-none transition-colors disabled:opacity-40 ${
        ICON_SIZE[size]
      } ${
        busy
          ? "text-sky-500 hover:text-sky-600"
          : "text-neutral-400 hover:text-sky-500 dark:text-neutral-500 dark:hover:text-sky-400"
      }`}
    >
      {iconNode}
    </button>
  );
}
