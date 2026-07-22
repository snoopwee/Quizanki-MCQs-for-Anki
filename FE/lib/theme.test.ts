import { describe, it, expect, afterEach, vi } from "vitest";
import {
  isThemePref,
  readThemePref,
  resolveTheme,
  systemTheme,
  THEME_KEY,
} from "./theme";

// The suite runs in the "node" environment (see vitest.config.ts), so there's no
// window/localStorage/matchMedia — stub a minimal one, same approach as the
// flashcardProgress / TTS tests.
function makeLocalStorage(seed?: Record<string, string>) {
  const store = new Map<string, string>(Object.entries(seed ?? {}));
  return {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
}

// matchMedia stub that reports the given OS dark-mode state.
function makeMatchMedia(prefersDark: boolean) {
  return (query: string) => ({ matches: prefersDark && query.includes("dark") });
}

function stubWindow(opts: { pref?: string; prefersDark?: boolean }) {
  vi.stubGlobal("window", {
    localStorage: makeLocalStorage(opts.pref ? { [THEME_KEY]: opts.pref } : undefined),
    matchMedia: makeMatchMedia(opts.prefersDark ?? false),
  });
}

describe("theme", () => {
  afterEach(() => vi.unstubAllGlobals());

  describe("isThemePref", () => {
    it("accepts the three valid prefs", () => {
      expect(isThemePref("light")).toBe(true);
      expect(isThemePref("dark")).toBe(true);
      expect(isThemePref("system")).toBe(true);
    });
    it("rejects anything else", () => {
      expect(isThemePref("blue")).toBe(false);
      expect(isThemePref(null)).toBe(false);
      expect(isThemePref(undefined)).toBe(false);
      expect(isThemePref(1)).toBe(false);
    });
  });

  describe("resolveTheme", () => {
    it("passes explicit light/dark straight through", () => {
      stubWindow({ prefersDark: true }); // OS is dark, but explicit wins
      expect(resolveTheme("light")).toBe("light");
      expect(resolveTheme("dark")).toBe("dark");
    });
    it("maps system to the OS preference", () => {
      stubWindow({ prefersDark: true });
      expect(resolveTheme("system")).toBe("dark");
      vi.unstubAllGlobals();
      stubWindow({ prefersDark: false });
      expect(resolveTheme("system")).toBe("light");
    });
  });

  describe("systemTheme", () => {
    it("defaults to light on the server (no window)", () => {
      expect(systemTheme()).toBe("light");
    });
    it("reads the media query when present", () => {
      stubWindow({ prefersDark: true });
      expect(systemTheme()).toBe("dark");
    });
  });

  describe("readThemePref", () => {
    it("returns system when nothing is stored", () => {
      stubWindow({});
      expect(readThemePref()).toBe("system");
    });
    it("returns the stored pref", () => {
      stubWindow({ pref: "dark" });
      expect(readThemePref()).toBe("dark");
    });
    it("falls back to system on a corrupt value", () => {
      stubWindow({ pref: "banana" });
      expect(readThemePref()).toBe("system");
    });
  });
});
