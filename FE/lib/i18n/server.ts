import { cookies } from "next/headers";
import { localeFromCookie, LOCALE_COOKIE, type Locale } from "@/lib/i18n/locale";

/**
 * The chosen language, read on the server.
 *
 * <p>Server-only — `next/headers` throws in a client component. This is what makes the language a
 * real server concern rather than a cosmetic client toggle: the root layout uses it for
 * `<html lang>`, and a server-rendered page can translate its own `metadata`.
 */
export async function getServerLocale(): Promise<Locale> {
  const store = await cookies();
  return localeFromCookie(store.get(LOCALE_COOKIE)?.value);
}
