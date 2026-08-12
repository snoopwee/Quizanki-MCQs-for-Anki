"use client";

import { useState } from "react";
import { Spinner } from "@/components/ui/Spinner";
import { Icon } from "@/components/ui/icons";

// Import-review audio: the clip isn't uploaded yet, so `resolve` lazily produces a
// playable URL (a blob extracted from the kept .apkg on first click). Until then
// it's a compact "Play audio" button; once resolved it becomes a full <audio>
// player (scrubber, duration, volume) and starts playing. Distinct from
// CardAudioSlot, which uploads/replaces a card's audio.
export function CardAudioPlayButton({
  resolve,
  label = "Play audio",
}: {
  resolve: () => Promise<string | null>;
  label?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function load(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    setFailed(false);
    setLoading(true);
    const resolved = await resolve();
    setLoading(false);
    if (!resolved) {
      setFailed(true);
      return;
    }
    setUrl(resolved);
  }

  if (url) {
    return <audio controls autoPlay preload="none" src={url} className="h-9 w-full max-w-xs" />;
  }

  return (
    <button
      type="button"
      onClick={load}
      disabled={loading}
      aria-label="Play audio"
      className="inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3 py-1 text-xs font-medium text-ink transition hover:border-accent hover:text-accent disabled:opacity-60"
    >
      {loading ? <Spinner className="h-3.5 w-3.5" /> : <Icon name="sound" size={13} />}
      <span>{failed ? "Audio unavailable" : label}</span>
    </button>
  );
}
