// Text-size (font-scale) preference: persistence + application. Scales the whole
// UI by setting the root <html> font-size as a PERCENTAGE — because Tailwind's
// text AND spacing utilities are rem-based, everything (type, padding, gaps,
// icons) grows together, so nothing overflows its container. A percentage (not
// px) multiplies the user's own browser base, so an OS/browser font-size bump
// still compounds (WCAG-friendly). Stored as a plain number (the percent), driven
// by a slider. Per-device UI state, localStorage-only — same rationale as
// lib/theme.ts (nothing here belongs on the backend).

export const TEXT_SIZE_KEY = "quizanki:text-size";

// Slider bounds (% of the browser base → 16 / … / 20px at a 16px base). The 100%
// floor keeps the smallest labels legible (no shrink); 125% is a safe ceiling for
// the app's few remaining fixed-px elements (browser zoom covers anyone past it).
export const TEXT_SIZE_MIN = 100;
export const TEXT_SIZE_MAX = 125;
export const TEXT_SIZE_STEP = 5;
export const TEXT_SIZE_DEFAULT = 100;

/** Clamp any input into the valid range, falling back to the default on garbage. */
export function clampTextSize(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return TEXT_SIZE_DEFAULT;
  return Math.min(TEXT_SIZE_MAX, Math.max(TEXT_SIZE_MIN, v));
}

/** Stored size (%), falling back to the default when unset / corrupt / SSR. */
export function readTextSize(): number {
  if (typeof window === "undefined") return TEXT_SIZE_DEFAULT;
  try {
    const raw = window.localStorage.getItem(TEXT_SIZE_KEY);
    return raw == null ? TEXT_SIZE_DEFAULT : clampTextSize(raw);
  } catch {
    return TEXT_SIZE_DEFAULT;
  }
}

/** Write the size (%) onto <html> so every rem-based size re-computes. */
export function applyTextSize(pct: number): void {
  if (typeof document === "undefined") return;
  document.documentElement.style.fontSize = `${clampTextSize(pct)}%`;
}

/** Best-effort persist; private mode / disabled storage just means it won't stick. */
export function storeTextSize(pct: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TEXT_SIZE_KEY, String(clampTextSize(pct)));
  } catch {
    /* ignore */
  }
}

// Runs inline (first thing in <body>) before the first paint so a saved larger
// size doesn't flash at 100% on reload. It can't import from this module — it's
// stringified into the page — so the key + bounds are duplicated here in vanilla
// JS. Keep in sync with the constants above.
export const TEXT_SIZE_INIT_SCRIPT = `(function(){try{var k=${JSON.stringify(
  TEXT_SIZE_KEY,
)};var lo=${TEXT_SIZE_MIN},hi=${TEXT_SIZE_MAX},d=${TEXT_SIZE_DEFAULT};var n=parseFloat(localStorage.getItem(k));if(!isFinite(n))n=d;n=Math.min(hi,Math.max(lo,n));document.documentElement.style.fontSize=n+"%";}catch(e){}})();`;
