"use client";

import { Card } from "@/components/ui/Card";
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
  onQuizWeak,
}: {
  deckId: string;
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

      {statsQuery.isError ? (
        <Card className="p-5">
          <p className="text-sm text-muted">Couldn&apos;t load your stats right now.</p>
        </Card>
      ) : statsQuery.isLoading || !statsQuery.data ? (
        <TileSkeleton />
      ) : (
        <Tiles
          seen={statsQuery.data.seenCards}
          accuracy={statsQuery.data.averageAccuracy}
          weak={statsQuery.data.weakCards}
          mastered={statsQuery.data.masteredCards}
        />
      )}

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

function Tiles({
  seen,
  accuracy,
  weak,
  mastered,
}: {
  seen: number;
  accuracy: number;
  weak: number;
  mastered: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Tile icon="clock" color="var(--info)" label="Cards seen" value={String(seen)} />
      <Tile
        icon="target"
        color="var(--accent)"
        label="Accuracy"
        // Accuracy is undefined until at least one card has been answered.
        value={seen === 0 ? "—" : `${Math.round(accuracy * 100)}%`}
      />
      <Tile icon="brain" color="var(--warning)" label="Still learning" value={String(weak)} />
      <Tile icon="flame" color="var(--success)" label="Mastered" value={String(mastered)} />
    </div>
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

function TileSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="flex flex-col gap-2 p-4">
          <div className="h-8 w-8 animate-pulse rounded-input bg-surface-2/60" />
          <div className="h-7 w-12 animate-pulse rounded bg-surface-2/60" />
          <div className="h-3 w-16 animate-pulse rounded bg-surface-2/60" />
        </Card>
      ))}
    </div>
  );
}
