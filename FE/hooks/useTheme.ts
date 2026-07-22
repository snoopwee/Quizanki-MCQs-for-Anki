"use client";

import { useCallback, useEffect, useState } from "react";
import {
  applyResolvedTheme,
  readThemePref,
  resolveTheme,
  storeThemePref,
  systemTheme,
  type ResolvedTheme,
  type ThemePref,
} from "@/lib/theme";

// Reactive theme preference for the Settings control. The inline script in the
// root layout has already applied the stored theme to <html> before paint, so
// this hook only mirrors it into React state (read on mount to dodge a hydration
// mismatch) and re-applies on change. While the preference is "system" it also
// follows live OS theme changes.
export function useTheme(): {
  pref: ThemePref;
  resolved: ResolvedTheme;
  setPref: (next: ThemePref) => void;
} {
  // Both server and first client render start from "system" so the markup matches;
  // the real stored value is read in the mount effect below.
  const [pref, setPrefState] = useState<ThemePref>("system");
  const [resolved, setResolved] = useState<ResolvedTheme>("light");

  useEffect(() => {
    const stored = readThemePref();
    setPrefState(stored);
    setResolved(resolveTheme(stored));
  }, []);

  // Follow the OS only while tracking "system".
  useEffect(() => {
    if (pref !== "system" || typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const next = systemTheme();
      setResolved(next);
      applyResolvedTheme(next);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [pref]);

  const setPref = useCallback((next: ThemePref) => {
    setPrefState(next);
    storeThemePref(next);
    const r = resolveTheme(next);
    setResolved(r);
    applyResolvedTheme(r);
  }, []);

  return { pref, resolved, setPref };
}
