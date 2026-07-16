// Theme preference: persistence + resolution. globals.css ships a full dark token
// set keyed off `[data-theme="dark"]` (see the Theming note there); this module is
// the single place that decides which value that attribute holds. The stored
// preference is one of light / dark / system — "system" tracks the OS setting and
// re-resolves live. Per-device UI state, localStorage-only (same rationale as
// lib/flashcardPreferences.ts — nothing here belongs on the backend).

export const THEME_KEY = "quizanki:theme";

export type ThemePref = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const PREFS: readonly ThemePref[] = ["light", "dark", "system"];

export function isThemePref(v: unknown): v is ThemePref {
  return typeof v === "string" && (PREFS as readonly string[]).includes(v);
}

/** The OS preference. Safe on the server (no matchMedia) — defaults to light. */
export function systemTheme(): ResolvedTheme {
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Stored preference, falling back to "system" when unset / corrupt / SSR. */
export function readThemePref(): ThemePref {
  if (typeof window === "undefined") return "system";
  try {
    const raw = window.localStorage.getItem(THEME_KEY);
    return isThemePref(raw) ? raw : "system";
  } catch {
    return "system";
  }
}

/** Collapse a preference to the concrete value the CSS attribute needs. */
export function resolveTheme(pref: ThemePref): ResolvedTheme {
  return pref === "system" ? systemTheme() : pref;
}

/** Write the resolved value onto <html> so the CSS vars re-map instantly. */
export function applyResolvedTheme(resolved: ResolvedTheme): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = resolved;
}

/** Best-effort persist; private mode / disabled storage just means it won't stick. */
export function storeThemePref(pref: ThemePref): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(THEME_KEY, pref);
  } catch {
    /* ignore */
  }
}

// Runs inline (first thing in <body>) before the first paint so a saved dark
// preference doesn't flash light on reload. It can't import from this module —
// it's stringified into the page — so the key + resolution logic are duplicated
// here in vanilla JS. Keep in sync with THEME_KEY / resolveTheme above.
export const THEME_INIT_SCRIPT = `(function(){try{var k=${JSON.stringify(
  THEME_KEY,
)};var p=localStorage.getItem(k);if(p!=="light"&&p!=="dark"&&p!=="system")p="system";var dark=p==="dark"||(p==="system"&&!!window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=dark?"dark":"light";}catch(e){}})();`;
