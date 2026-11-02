"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import {
  DEFAULT_LOCALE,
  storeLocale,
  type Locale,
} from "@/lib/i18n/locale";
import { en } from "@/lib/i18n/messages/en";
import { vi } from "@/lib/i18n/messages/vi";
import { translate, type Catalogue, type Vars } from "@/lib/i18n/translate";
import type { MessageKey } from "@/lib/i18n/messages/en";

const CATALOGUES: Record<Locale, Catalogue> = { en, vi };

/** `t("auth.logIn")` — keys are checked against the English catalogue at compile time. */
export type Translate = (key: MessageKey, vars?: Vars) => string;

interface LocaleContextValue {
  locale: Locale;
  t: Translate;
  setLocale: (next: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

/**
 * Holds the chosen language for the client tree.
 *
 * <p><b>`initialLocale` is read on the SERVER</b> from the cookie and handed down, rather than
 * discovered in a mount effect the way `useTheme` does it. The difference matters: theme is one
 * attribute an inline script can fix before paint, but language is the text itself — reading it
 * after mount would render the whole page in English and then swap it, which is both a flash and
 * a hydration mismatch on every string.
 *
 * <p>Changing the language reloads the page. That is deliberate: `metadata`, the legal pages and
 * anything else server-rendered are produced from the cookie, and only a fresh request re-renders
 * them. A silent in-place swap would leave the `<title>`, the Open Graph tags and `/privacy` in
 * the previous language.
 */
export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    storeLocale(next);
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  }, []);

  const value = useMemo<LocaleContextValue>(() => {
    const catalogue = CATALOGUES[locale] ?? CATALOGUES[DEFAULT_LOCALE];
    return {
      locale,
      setLocale,
      t: (key, vars) => translate(catalogue, key, vars),
    };
  }, [locale, setLocale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

function useLocaleContext(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    // Rendering English rather than throwing: a component used outside the provider (a test, a
    // stray tree) should still show words. A crash here would take down a page over a label.
    return {
      locale: DEFAULT_LOCALE,
      setLocale: () => {},
      t: (key, vars) => translate(en, key, vars),
    };
  }
  return ctx;
}

/** The translator. The common case — a component only needs `t`. */
export function useT(): Translate {
  return useLocaleContext().t;
}

/** The current language and a way to change it; for the Settings control. */
export function useLocale(): { locale: Locale; setLocale: (next: Locale) => void } {
  const { locale, setLocale } = useLocaleContext();
  return { locale, setLocale };
}
