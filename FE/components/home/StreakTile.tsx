"use client";

import { Icon } from "@/components/ui/icons";
import { StatTile } from "@/components/ui/StatTile";
import { useStreak } from "@/hooks/useStreak";
import { streakCaption, streakValue, weekdayLabel } from "@/lib/streakDisplay";

// Home's daily study streak. A day counts once you answer a quiz or Learn question, or
// study the deck-page flashcards — filed under YOUR local calendar date, because the
// browser reports its timezone with each study action. The strip shows today and the six
// days before it, oldest first, so today is always the last dot.
export function StreakTile({ className = "" }: { className?: string }) {
  const { data, isError } = useStreak();

  const sub = data
    ? `${streakCaption(data)} · best ${data.longest}`
    : isError
      ? "Couldn't load your streak"
      : undefined;

  return (
    <StatTile
      className={className}
      icon={<Icon name="flame" size={18} />}
      label="Study streak"
      value={data ? streakValue(data.current) : "—"}
      sub={sub}
    >
      {data ? (
        // Seven equal grid columns, not justify-between: the weekday letters differ in
        // width ("M" vs "T"), which would space the dots unevenly.
        <ol aria-label="Study days this week" className="mt-3 grid grid-cols-7 gap-1">
          {data.last7Days.map((day, i) => {
            const isToday = i === data.last7Days.length - 1;
            const name = isToday ? "Today" : weekdayLabel(day.date, "long");
            return (
              <li
                key={day.date}
                aria-label={`${name}: ${day.studied ? "studied" : "not studied"}`}
                className="flex flex-col items-center gap-1"
              >
                {/* Equal 24px circles so the week reads as one even row. Studied = a soft
                    accent fill with a check; today, not yet studied = a dashed accent ring. */}
                <span
                  aria-hidden
                  className={`grid h-6 w-6 place-items-center rounded-full border ${
                    day.studied
                      ? "border-accent/40 bg-accent-soft text-accent"
                      : isToday
                        ? "border-dashed border-accent/60 bg-surface"
                        : "border-line bg-surface-2"
                  }`}
                >
                  {day.studied && <Icon name="check" size={13} />}
                </span>
                <span
                  aria-hidden
                  className={`text-[0.6875rem] font-medium ${isToday ? "text-ink" : "text-faint"}`}
                >
                  {weekdayLabel(day.date)}
                </span>
              </li>
            );
          })}
        </ol>
      ) : isError ? null : (
        // Loading skeleton with the real strip's footprint, so nothing jumps when it loads.
        <ol aria-hidden className="mt-3 grid grid-cols-7 gap-1">
          {Array.from({ length: 7 }, (_, i) => (
            <li key={i} className="flex flex-col items-center gap-1">
              <span className="h-6 w-6 animate-pulse rounded-full bg-surface-2" />
              <span className="h-4 w-2.5 animate-pulse rounded bg-surface-2" />
            </li>
          ))}
        </ol>
      )}
    </StatTile>
  );
}
