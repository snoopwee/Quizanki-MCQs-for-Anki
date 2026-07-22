"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/ui/icons";
import { buttonClasses } from "@/components/ui/Button";
import { textDirection } from "@/lib/displayText";
import { RichText } from "@/components/shared/RichText";
import type { Flashcard } from "@/lib/flashcards";
import {
  MATCH_PAIRS_PER_ROUND,
  buildMatchTiles,
  isMatch,
  formatMatchTime,
  loadBestMatchTime,
  saveBestMatchTime,
  matchableCards,
  type MatchTile,
} from "@/lib/matchGame";

// The timed pairing game. Tap two tiles: opposite faces of the same card lock in
// (fade out); a mismatch flashes red and resets. The timer starts on the first
// tap and stops when the board is cleared. Fully client-side — no answers recorded.
export function MatchGame({
  cards,
  deckId,
  deckName,
  onExit,
}: {
  cards: Flashcard[];
  deckId: string;
  deckName: string;
  onExit: () => void;
}) {
  const playable = useMemo(() => matchableCards(cards), [cards]);
  const pairCount = Math.min(MATCH_PAIRS_PER_ROUND, playable.length);
  // Only full rounds count toward the personal best, so different-sized boards
  // (tiny decks) aren't compared against a 6-pair time.
  const fullRound = pairCount === MATCH_PAIRS_PER_ROUND;

  const [tiles, setTiles] = useState<MatchTile[]>(() => buildMatchTiles(cards, pairCount));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [wrong, setWrong] = useState<[string, string] | null>(null);

  const startRef = useRef<number | null>(null);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [done, setDone] = useState(false);
  const [best, setBest] = useState<number | null>(null);

  // Load the stored best (full rounds only) on mount / deck change.
  useEffect(() => {
    setBest(fullRound ? loadBestMatchTime(deckId) : null);
  }, [deckId, fullRound]);

  // Tick the count-up timer while a round is in progress.
  useEffect(() => {
    if (!running || done) return;
    const id = window.setInterval(() => {
      if (startRef.current !== null) setElapsed(performance.now() - startRef.current);
    }, 100);
    return () => window.clearInterval(id);
  }, [running, done]);

  function newRound() {
    setTiles(buildMatchTiles(cards, pairCount));
    setSelectedId(null);
    setMatched(new Set());
    setWrong(null);
    setRunning(false);
    setDone(false);
    setElapsed(0);
    startRef.current = null;
  }

  function pick(tile: MatchTile) {
    if (done || wrong || matched.has(tile.tileId)) return;
    if (!running) {
      startRef.current = performance.now();
      setRunning(true);
    }
    if (selectedId === null) {
      setSelectedId(tile.tileId);
      return;
    }
    if (selectedId === tile.tileId) {
      setSelectedId(null); // tapping the selected tile again deselects it
      return;
    }
    const first = tiles.find((t) => t.tileId === selectedId);
    if (!first) {
      setSelectedId(tile.tileId);
      return;
    }
    if (isMatch(first, tile)) {
      const next = new Set(matched);
      next.add(first.tileId);
      next.add(tile.tileId);
      setMatched(next);
      setSelectedId(null);
      if (next.size === tiles.length) {
        const final = performance.now() - (startRef.current ?? performance.now());
        setElapsed(final);
        setDone(true);
        setRunning(false);
        if (fullRound && (best === null || final < best)) {
          saveBestMatchTime(deckId, final);
          setBest(final);
        }
      }
    } else {
      // Brief red flash on the mismatched pair, then clear — input is ignored
      // until it resets (the `wrong` guard at the top of pick()).
      setWrong([first.tileId, tile.tileId]);
      setSelectedId(null);
      window.setTimeout(() => setWrong(null), 650);
    }
  }

  const totalPairs = tiles.length / 2;

  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col px-4 py-4 sm:px-6">
      {/* top bar: exit · title · timer */}
      <div className="flex shrink-0 items-center gap-3 border-b border-line pb-4">
        <button
          type="button"
          onClick={onExit}
          title="Exit match"
          aria-label="Exit match"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-input border border-line bg-surface text-muted transition hover:text-ink"
        >
          <Icon name="x" size={17} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-xs uppercase tracking-[0.08em] text-faint">
            Match · {deckName}
          </p>
          <p className="text-sm font-medium text-muted">Pair every term with its meaning</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-input border border-line bg-surface px-3 py-1.5 font-mono text-lg font-bold tabular-nums text-ink">
          <Icon name="clock" size={16} />
          {formatMatchTime(elapsed)}
        </div>
      </div>

      {tiles.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <p className="max-w-sm text-sm text-muted">
            Match needs at least two cards that have both a term and a definition. This deck
            doesn&apos;t have enough yet.
          </p>
          <button type="button" onClick={onExit} className={buttonClasses({ variant: "soft" })}>
            Back to deck
          </button>
        </div>
      ) : done ? (
        <CompletionPanel
          elapsed={elapsed}
          best={best}
          fullRound={fullRound}
          onPlayAgain={newRound}
          onExit={onExit}
        />
      ) : (
        <div className="nice-scroll min-h-0 flex-1 overflow-y-auto">
          <div className="flex min-h-full flex-col justify-center py-6">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
              {tiles.map((tile) => {
                const isMatched = matched.has(tile.tileId);
                const isSelected = selectedId === tile.tileId;
                const isWrong = wrong?.includes(tile.tileId) ?? false;
                let cls =
                  "focus-ring flex h-28 items-center justify-center rounded-card border p-3 text-center text-sm font-medium transition-all sm:h-32 ";
                if (isMatched) cls += "pointer-events-none scale-95 border-transparent opacity-0";
                else if (isWrong) cls += "border-danger bg-danger/10 text-danger";
                else if (isSelected) cls += "border-accent bg-accent-soft text-accent-ink ring-2 ring-accent/30";
                else cls += "border-line-strong bg-surface text-ink hover:border-accent hover:bg-accent-soft";
                return (
                  <button
                    key={tile.tileId}
                    type="button"
                    onClick={() => pick(tile)}
                    disabled={isMatched || done}
                    className={cls}
                  >
                    <span
                      dir={textDirection(tile.text)}
                      className="nice-scroll max-h-full overflow-y-auto break-words"
                    >
                      <RichText text={tile.text} />
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-5 text-center font-mono text-xs text-muted">
              {matched.size / 2} of {totalPairs} pairs matched
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// Shown when the board is cleared: the finishing time, a best-time line (full
// rounds only), and Play again / Back actions.
function CompletionPanel({
  elapsed,
  best,
  fullRound,
  onPlayAgain,
  onExit,
}: {
  elapsed: number;
  best: number | null;
  fullRound: boolean;
  onPlayAgain: () => void;
  onExit: () => void;
}) {
  // We saved `best` to `elapsed` only when this round beat it, so equal rounded
  // values mean this run set the record.
  const isNewBest = fullRound && best !== null && Math.round(best) === Math.round(elapsed);
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 py-10 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-full bg-success/15 text-success">
        <Icon name="check" size={30} />
      </div>
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.08em] text-faint">All matched</p>
        <p className="mt-1 font-display text-5xl font-bold tabular-nums text-ink">
          {formatMatchTime(elapsed)}
        </p>
        {fullRound && (best !== null) && (
          <p className="mt-2 text-sm font-medium text-muted">
            {isNewBest ? "🎉 New best time!" : `Best: ${formatMatchTime(best)}`}
          </p>
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <button type="button" onClick={onExit} className={buttonClasses({ variant: "ghost" })}>
          Back to deck
        </button>
        <button type="button" onClick={onPlayAgain} className={buttonClasses({ variant: "primary" })}>
          <Icon name="shuffle" size={16} /> Play again
        </button>
      </div>
    </div>
  );
}
