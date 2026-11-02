"use client";

import { Icon } from "@/components/ui/icons";
import { StatTile } from "@/components/ui/StatTile";
import { useStreak } from "@/hooks/useStreak";
import { streakCaptionKey, weekdayLabel } from "@/lib/streakDisplay";
import { useLocale, useT } from "@/components/i18n/LocaleProvider";

// Home's daily study streak. A day counts once you answer a quiz or Learn question, or
// study the deck-page flashcards — filed under YOUR local calendar date, because the
// browser reports its timezone with each study action. The strip shows today and the six
// days before it, oldest first, so today is always the last dot.
export function StreakTile({ className = "" }: { className?: string }) {
  const { data, isError } = useStreak();
  const t = useT();
  const { locale } = useLocale();

  const sub = data
    ? `${t(streakCaptionKey(data))} · ${t("home.streakBest", { count: data.longest })}`
    : isError
      ? t("home.streakError")
      : undefined;

  return (
    <StatTile
      className={className}
      icon={<Icon name="flame" size={18} />}
      label={t("home.studyStreak")}
      value={data ? t("home.streakDays", { count: data.current }) : "—"}
      sub={sub}
    >
      {data ? (
        // Seven equal grid columns, not justify-between: the weekday letters differ in
        // width ("M" vs "T"), which would space the dots unevenly.
        //
        // "the last 7 days", not "this week": the strip ENDS on today and rolls, so on a Monday
        // it reads T W T F S S M. Labelled as a week, that looks like a calendar that starts on
        // Tuesday; labelled as a rolling window it reads correctly. The visible caption below
        // says the same thing to everyone else.
        <>
          <ol aria-label={t("home.studyDaysAria")} className="mt-3 grid grid-cols-7 gap-1">
          {data.last7Days.map((day, i) => {
            const isToday = i === data.last7Days.length - 1;
            const name = isToday ? t("home.today") : weekdayLabel(day.date, "long", locale);
            return (
              <li
                key={day.date}
                aria-label={`${name}: ${day.studied ? t("home.studied") : t("home.notStudied")}`}
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
                  {weekdayLabel(day.date, "narrow", locale)}
                </span>
              </li>
            );
          })}
          </ol>
          <p aria-hidden className="mt-1.5 text-center font-mono text-[0.625rem] text-faint">
            {t("home.last7Days")}
          </p>
        </>
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
