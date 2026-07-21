"use client";

import { Card } from "@/components/ui/Card";
import { Ring } from "@/components/ui/Ring";
import { Icon, type IconName } from "@/components/ui/icons";
import { buttonClasses } from "@/components/ui/Button";
import { useDeckStats, useDeckStatsHistory } from "@/hooks/useDeckStats";
import { AccuracyChart } from "@/components/deck/AccuracyChart";

const HISTORY_DAYS = 30;

// The deck's "Your progress" section: five stat tiles fed by /decks/{id}/stats
// (data card_stats already maintains) plus the accuracy-over-time chart. Each
// performance tile ships an icon + label, never color alone.
export function DeckStatsPanel({
  deckId,
  completion,
  onQuizWeak,
}: {
  deckId: string;
  // Mean mastery across the whole deck (0–100). Shown as the headline ring; moved
  // here from the deck header so all progress lives in one place.
  completion: number;
  // Jump into quiz setup with the "weak" source preselected.
  onQuizWeak: () => void;
}) {
  const statsQuery = useDeckStats(deckId);
  const historyQuery = useDeckStatsHistory(deckId, HISTORY_DAYS);

  return (
    <section aria-labelledby="progress-heading" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p
          id="progress-heading"
          className="font-mono text-xs font-semibold uppercase tracking-[0.06em] text-muted"
        >
          Your progress
        </p>
        {statsQuery.data && statsQuery.data.weakCards > 0 && (
          <button
            type="button"
            onClick={onQuizWeak}
            className={buttonClasses({ variant: "ghost", size: "sm" })}
          >
            <Icon name="brain" size={15} /> Quiz weak cards
          </button>
        )}
      </div>

      {/* Overview tiles. The mastery ring leads (it comes from deck contents, so it
          shows immediately); the four data tiles fill the rest — or a skeleton /
          error spanning their columns while the stats query resolves. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <MasteryTile completion={completion} />

        {statsQuery.isError ? (
          <Card className="col-span-2 flex items-center p-4 lg:col-span-4">
            <p className="text-sm text-muted">Couldn&apos;t load your stats right now.</p>
          </Card>
        ) : statsQuery.isLoading || !statsQuery.data ? (
          Array.from({ length: 4 }).map((_, i) => <TileSkeleton key={i} />)
        ) : (
          <>
            <Tile
              icon="clock"
              color="var(--info)"
              label="Cards seen"
              value={String(statsQuery.data.seenCards)}
            />
            <Tile
              icon="target"
              color="var(--accent)"
              label="Accuracy"
              // Accuracy is undefined until at least one card has been answered.
              value={
                statsQuery.data.seenCards === 0
                  ? "—"
                  : `${Math.round(statsQuery.data.averageAccuracy * 100)}%`
              }
            />
            <Tile
              icon="brain"
              color="var(--warning)"
              label="Still learning"
              value={String(statsQuery.data.weakCards)}
            />
            <Tile
              icon="flame"
              color="var(--success)"
              label="Mastered"
              value={String(statsQuery.data.masteredCards)}
            />
          </>
        )}
      </div>

      <Card className="p-5">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h3 className="font-display text-base font-semibold tracking-tight text-ink">
            Accuracy over time
          </h3>
          <span className="text-xs text-faint">Last {HISTORY_DAYS} days</span>
        </div>
        {historyQuery.isError ? (
          <p className="py-8 text-center text-sm text-muted">Couldn&apos;t load your history.</p>
        ) : historyQuery.isLoading || !historyQuery.data ? (
          <div className="h-44 animate-pulse rounded-card bg-surface-2/50" />
        ) : (
          <AccuracyChart points={historyQuery.data} />
        )}
      </Card>
    </section>
  );
}

// The mastery ring rendered as a stat tile — a bare Ring stands in for the icon
// chip so it reads as one of the row. It spans both columns on small screens (where
// the grid is 2-up) so the four data tiles still pair off cleanly beneath it; on
// large screens it's the first of five equal columns. Horizontal on mobile to fill
// that full-width row, vertical on desktop to match the data tiles' shape.
function MasteryTile({ completion }: { completion: number }) {
  return (
    <Card className="col-span-2 flex flex-row items-center gap-3 p-4 lg:col-span-1 lg:flex-col lg:items-start lg:gap-2">
      <Ring value={completion / 100} size={40} stroke={5} />
      <div>
        <div className="font-mono text-2xl font-bold leading-none text-ink">
          {Math.round(completion)}%
        </div>
        <div className="mt-1 text-xs text-muted">Deck mastery</div>
      </div>
    </Card>
  );
}

function Tile({
  icon,
  color,
  label,
  value,
}: {
  icon: IconName;
  color: string;
  label: string;
  value: string;
}) {
  return (
    <Card className="flex flex-col gap-2 p-4">
      <span
        className="grid h-8 w-8 place-items-center rounded-input"
        style={{ background: `color-mix(in oklab, ${color} 16%, transparent)`, color }}
      >
        <Icon name={icon} size={17} />
      </span>
      <div>
        <div className="font-mono text-2xl font-bold leading-none text-ink">{value}</div>
        <div className="mt-1 text-xs text-muted">{label}</div>
      </div>
    </Card>
  );
}

// One placeholder tile — the grid maps four of these while the stats query loads.
function TileSkeleton() {
  return (
    <Card className="flex flex-col gap-2 p-4">
      <div className="h-8 w-8 animate-pulse rounded-input bg-surface-2/60" />
      <div className="h-7 w-12 animate-pulse rounded bg-surface-2/60" />
      <div className="h-3 w-16 animate-pulse rounded bg-surface-2/60" />
    </Card>
  );
}
