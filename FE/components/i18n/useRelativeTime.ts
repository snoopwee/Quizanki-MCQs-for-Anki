"use client";

import { relativeStamp } from "@/lib/notificationDisplay";
import { useLocale, useT } from "@/components/i18n/LocaleProvider";

/**
 * Renders `relativeStamp` into text. One hook rather than the same four lines in every row:
 * a stamp older than a week is an absolute date, and formatting that needs the reader's locale,
 * which a pure module does not have.
 */
export function useRelativeTime(): (iso: string | null | undefined, now?: Date) => string {
  const t = useT();
  const { locale } = useLocale();

  return (iso, now) => {
    const stamp = relativeStamp(iso, now);
    if (!stamp) return "";
    if ("isoDate" in stamp) {
      return new Date(stamp.isoDate).toLocaleDateString(locale, { month: "short", day: "numeric" });
    }
    return t(stamp.key, stamp.vars);
  };
}
