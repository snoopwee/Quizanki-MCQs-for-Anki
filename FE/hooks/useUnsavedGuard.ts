"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Warns before leaving a page with unsaved work.
 *
 * Two escape routes have to be covered separately:
 *
 *  - **Closing / reloading the tab** — `beforeunload`, which is all the browser
 *    lets us do (the confirmation text itself is the browser's, not ours).
 *  - **Navigating inside the app** — the App Router exposes no route-change
 *    event to cancel, so we intercept the click on the way to the link instead:
 *    a capture-phase listener catches same-origin `<a href>` clicks, stops them,
 *    and hands the destination back so the caller can show a confirm dialog.
 *
 * Not covered: the browser Back button. `history` can only be guarded by pushing
 * dummy entries, which breaks the back button in its own right — the autosaved
 * draft (lib/draftStore.ts) is the safety net for that case.
 */
export function useUnsavedGuard(active: boolean) {
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;

    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      // Legacy browsers need returnValue set; the string is never displayed.
      e.returnValue = "";
    }

    function onClick(e: MouseEvent) {
      // Let the browser handle anything that isn't a plain left-click on a link
      // (new tab, download, external site, modified click).
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }
      const anchor = (e.target as HTMLElement | null)?.closest?.("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      // Same page (or a pure hash change) isn't leaving.
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      e.preventDefault();
      e.stopPropagation();
      setPendingHref(url.pathname + url.search);
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true); // capture: beat Next's Link
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [active]);

  const cancel = useCallback(() => setPendingHref(null), []);

  return { pendingHref, cancel };
}
