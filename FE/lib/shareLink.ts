// The public URL of a shared deck. The deck's own UUID is the share token — the
// backend 404s anything not currently shared, so an old link simply stops working
// once the owner switches sharing off.
//
// Kept as a pure function of `origin` so it can be unit tested and so callers
// decide where the origin comes from (`window.location.origin` in the browser).

export function buildShareUrl(origin: string, deckId: string): string {
  return `${origin.replace(/\/+$/, "")}/shared/${deckId}`;
}

/** The share URL for the current page's origin, or "" during server render. */
export function currentShareUrl(deckId: string): string {
  if (typeof window === "undefined") return "";
  return buildShareUrl(window.location.origin, deckId);
}
