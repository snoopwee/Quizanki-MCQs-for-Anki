// Which language the interface is in: persistence and validation.
//
// ⚠ A COOKIE, not localStorage — and that is the one real difference from lib/theme.ts.
// Theme gets away with localStorage because an inline script rewrites <html> before first paint,
// so the server never has to know. Language cannot: `/privacy` and `/terms` are SERVER components
// and `metadata` (title, description, Open Graph) is generated on the server, so if the server
// rendered English while the browser wanted Vietnamese we would ship a hydration mismatch and an
// English <title> on a Vietnamese page. A cookie is the only store both sides can read.
//
// Deliberately NOT a URL segment (/vi/...): user decision 2026-10-26. The cost of that choice is
// that Google cannot index a Vietnamese version of the public pages; revisit if Vietnamese search
// traffic ever matters. Adding routing later is additive, not a rewrite.

/** Cookie name. Underscored, not `quizanki:locale` — ":" is a separator in RFC 6265 cookie names. */
export const LOCALE_COOKIE = "quizanki_locale";

export const LOCALES = ["en", "vi"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** What each language calls itself — never "Vietnamese", which is no help if you can't read it. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  vi: "Tiếng Việt",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * The locale from a raw cookie value, falling back to the default for anything unrecognised.
 *
 * <p>Pure, and takes the value rather than reading it, so both the server (`cookies()`) and the
 * browser (`document.cookie`) can share one definition of what is valid — and so it is testable
 * without a request.
 */
export function localeFromCookie(raw: string | null | undefined): Locale {
  return isLocale(raw) ? raw : DEFAULT_LOCALE;
}

/** Pull our cookie out of a raw `document.cookie` string. Returns the default when absent. */
export function localeFromDocumentCookie(cookieString: string): Locale {
  for (const part of cookieString.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === LOCALE_COOKIE) {
      return localeFromCookie(decodeURIComponent(rest.join("=")));
    }
  }
  return DEFAULT_LOCALE;
}

/** A year, so the choice survives. */
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/**
 * The `document.cookie` assignment that stores a choice.
 *
 * <p>`SameSite=Lax` rather than `Strict`: a learner following a shared deck link from a chat app
 * arrives cross-site, and `Strict` would withhold the cookie on exactly that first request — the
 * page would render in English for someone who chose Vietnamese.
 */
export function localeCookieAssignment(locale: Locale): string {
  return `${LOCALE_COOKIE}=${locale}; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
}

/** Best-effort persist, mirroring `storeThemePref`: blocked storage just means it won't stick. */
export function storeLocale(locale: Locale): void {
  if (typeof document === "undefined") return;
  try {
    document.cookie = localeCookieAssignment(locale);
  } catch {
    /* ignore */
  }
}

/**
 * A first guess from the browser's own languages, used only when nothing is stored.
 *
 * <p>Matches on the primary subtag so `vi-VN` counts as Vietnamese. Someone arriving from a
 * Vietnamese device should not have to find a setting to read the page.
 */
export function preferredLocale(languages: readonly string[]): Locale {
  for (const tag of languages) {
    const primary = tag.toLowerCase().split("-")[0];
    if (isLocale(primary)) return primary;
  }
  return DEFAULT_LOCALE;
}
