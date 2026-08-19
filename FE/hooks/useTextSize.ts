"use client";

import { useCallback, useEffect, useState } from "react";
import {
  applyTextSize,
  readTextSize,
  storeTextSize,
  TEXT_SIZE_DEFAULT,
} from "@/lib/textSize";

// Reactive text-size preference for the Settings slider. The inline script in the
// root layout has already applied the stored size to <html> before paint, so this
// hook only mirrors it into React state (read on mount to dodge a hydration
// mismatch) and re-applies on change (live as the slider is dragged).
export function useTextSize(): {
  size: number;
  setSize: (next: number) => void;
} {
  // Server + first client render start from the default so the markup matches; the
  // real stored value is read in the mount effect below.
  const [size, setSizeState] = useState<number>(TEXT_SIZE_DEFAULT);

  useEffect(() => {
    setSizeState(readTextSize());
  }, []);

  const setSize = useCallback((next: number) => {
    setSizeState(next);
    storeTextSize(next);
    applyTextSize(next);
  }, []);

  return { size, setSize };
}
