import { cookies } from "next/headers";
import { localeFromCookie, LOCALE_COOKIE, type Locale } from "@/lib/i18n/locale";
import { en, type MessageKey } from "@/lib/i18n/messages/en";
import { vi } from "@/lib/i18n/messages/vi";
import { translate, type Catalogue, type Vars } from "@/lib/i18n/translate";

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

/**
 * A translator for SERVER components and `generateMetadata`.
 *
 * <p>This is the half that makes the cookie worth having: `metadata` is produced on the server,
 * so a `<title>` can only be translated if the server knows the language before it renders. The
 * client's `useT` cannot reach here at all.
 */
export async function getServerT(): Promise<(key: MessageKey, vars?: Vars) => string> {
  const locale = await getServerLocale();
  const catalogue: Catalogue = locale === "vi" ? vi : en;
  return (key, vars) => translate(catalogue, key, vars);
}
