"use client";

import { Icon } from "@/components/ui/icons";
import { useStreak } from "@/hooks/useStreak";
import { streakCaptionKey } from "@/lib/streakDisplay";
import { useT } from "@/components/i18n/LocaleProvider";

// The daily study streak, compact, for the top bar: the number only — the Home tile keeps the
// seven-day strip. It shares the ["streak"] query with that tile, so having both costs one
// request. Lit (accent) once today counts; muted until then, since a streak survives a day you
// haven't studied yet.
export function StreakChip() {
  const t = useT();
  const { data, isError } = useStreak();

  // This bar is chrome on every page — a failed streak fetch shouldn't put an error in it.
  if (isError) return null;

  if (!data) {
    return <span aria-hidden className="h-8 w-14 shrink-0 animate-pulse rounded-full bg-surface-2" />;
  }

  return (
    <span
      title={t("streak.title", {
        caption: t(streakCaptionKey(data)),
        best: data.longest,
      })}
      aria-label={t("streak.aria", {
        value: t("streak.dayCount", { count: data.current }),
        caption: t(streakCaptionKey(data)),
      })}
      className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-2.5 font-mono text-sm font-bold ${
        data.studiedToday
          ? "border-accent/40 bg-accent-soft text-accent-ink"
          : "border-line-strong bg-surface text-muted"
      }`}
    >
      <Icon name="flame" size={16} className="shrink-0" />
      {data.current}
    </span>
  );
}
