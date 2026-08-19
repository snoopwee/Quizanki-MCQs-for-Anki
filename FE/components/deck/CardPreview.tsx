// Shared card-preview primitives used by both the flashcard study screen and the
// quiz results "missed cards" list, so the two lists look identical.

"use client";

import { useEffect, useState, type ReactNode } from "react";
import { classifyMastery, type StageInfo } from "@/lib/masteryStage";
import { textDirection } from "@/lib/displayText";
import { RichText } from "@/components/shared/RichText";

// Renders each field value on its own line, or a muted placeholder when empty.
// Per line we set `dir` so Arabic/Hebrew fields lay out RTL, and placeholder any
// LaTeX so math markup doesn't leak as raw source.
export function Lines({ values, className = "" }: { values: string[]; className?: string }) {
  if (values.length === 0) {
    return <span className="text-faint">(empty)</span>;
  }
  return (
    <>
      {values.map((v, i) => (
        <span key={i} dir={textDirection(v)} className={`block break-words ${className}`}>
          <RichText text={v} />
        </span>
      ))}
    </>
  );
}

// Small status pill: "Learning · 25%", colour-coded by mastery stage.
export function StageBadge({ info }: { info: StageInfo }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${info.pillClass}`}
    >
      <span>{info.label}</span>
      {info.stage !== "new" && (
        <>
          <span aria-hidden className="opacity-60">
            ·
          </span>
          <span className="tabular-nums">{info.percent}%</span>
        </>
      )}
    </span>
  );
}

// A single front/back row. Grid so the row height is driven by the FRONT column;
// the back cell stretches to that height and its content scrolls (the absolute
// child has no intrinsic height, so a long back can't push the row taller).
//
// `stats`, when present, surfaces a colour-coded mastery badge above the row so
// the learner sees per-card progress as they scan the deck.
//
// `action`, when present, is rendered top-right of the row — the deck detail page
// passes the per-card "⋯" edit menu here.
//
// `hiddenSide` blanks one column (for self-testing from the study rail) until the
// learner taps to reveal it; the reveal is per-row and resets whenever the hidden
// side changes.
export function CardPreviewRow({
  front,
  back,
  frontImageUrl = null,
  backImageUrl = null,
  frontAudioUrl = null,
  backAudioUrl = null,
  stats,
  action,
  hiddenSide = null,
}: {
  front: string[];
  back: string[];
  // Per-face image URL, shown as a thumbnail above that column's text.
  frontImageUrl?: string | null;
  backImageUrl?: string | null;
  // Per-face audio URL — an audio-only face (no text, no image) shows a Play
  // button instead of an empty cell (e.g. a listening card's front).
  frontAudioUrl?: string | null;
  backAudioUrl?: string | null;
  stats?: { mastery?: number; timesSeen?: number };
  action?: ReactNode;
  hiddenSide?: "front" | "back" | null;
}) {
  const info = stats ? classifyMastery(stats) : null;
  const [revealed, setRevealed] = useState(false);
  // Re-cover the card when the hidden side is toggled on/off or switched.
  useEffect(() => setRevealed(false), [hiddenSide]);

  const hideFront = hiddenSide === "front" && !revealed;
  const hideBack = hiddenSide === "back" && !revealed;

  return (
    <li className="space-y-2 rounded-input border border-line bg-surface p-4 text-sm">
      {(info || action) && (
        <div className="flex items-start justify-between gap-2">
          {info ? <StageBadge info={info} /> : <span />}
          {action}
        </div>
      )}
      <div className="grid grid-cols-[1fr_2fr] gap-4">
        <div className="relative space-y-1 font-medium text-ink">
          {frontImageUrl && <Thumb url={frontImageUrl} />}
          <FaceContent values={front} audioUrl={frontAudioUrl} hasImage={Boolean(frontImageUrl)} />
          {hideFront && <Cover onReveal={() => setRevealed(true)} />}
        </div>
        <div className="relative border-l border-line">
          <div className="nice-scroll absolute inset-0 space-y-1 overflow-y-auto pl-4 text-muted">
            {backImageUrl && <Thumb url={backImageUrl} />}
            <FaceContent values={back} audioUrl={backAudioUrl} hasImage={Boolean(backImageUrl)} />
          </div>
          {hideBack && <Cover onReveal={() => setRevealed(true)} />}
        </div>
      </div>
    </li>
  );
}

// A face's content in the preview list: the text, or — for an audio-only face
// with no text and no image (a listening card's front) — a Play button so the row
// isn't just "(empty)". The clip's play/stop state is keyed by its URL, so the id
// here only needs to be stable-ish.
function FaceContent({
  values,
  audioUrl,
  hasImage,
}: {
  values: string[];
  audioUrl: string | null;
  hasImage: boolean;
}) {
  if (values.length === 0 && audioUrl && !hasImage) {
    return <audio controls preload="none" src={audioUrl} className="h-8 w-full max-w-[220px]" />;
  }
  return <Lines values={values} />;
}

// A card face's image in the preview list — small, so a row stays scannable.
function Thumb({ url }: { url: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- arbitrary Supabase Storage host; next/image would need remotePatterns config
    <img src={url} alt="" className="max-h-20 rounded object-contain" />
  );
}

// The tap-to-reveal blanking overlay. Sits over its (relative) column, so the
// real content underneath still drives the row height while it's covered.
function Cover({ onReveal }: { onReveal: () => void }) {
  return (
    <button
      type="button"
      onClick={onReveal}
      aria-label="Reveal card"
      className="focus-ring absolute inset-0 z-10 grid place-items-center rounded-input bg-surface-2 text-xs font-medium text-faint transition hover:text-muted"
    >
      Tap to reveal
    </button>
  );
}
