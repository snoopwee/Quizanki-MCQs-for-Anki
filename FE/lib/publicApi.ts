import type { AuthorPageResponse, PublicDeckPage, PublicDeckSummary } from "@/types/api";

/**
 * Server-side reads of the public API, for metadata and the sitemap.
 *
 * Deliberately NOT `lib/axios.ts`: that attaches the signed-in user's token from the browser
 * session, and none of this runs in a browser. These endpoints are unauthenticated by design —
 * they are what a guest already sees.
 *
 * Everything here returns null rather than throwing. Metadata must never be the reason a page
 * fails to render: the backend sleeps on Render's free tier, so a cold start can be slow or time
 * out, and the right answer then is a generic title, not a 500.
 */

const TIMEOUT_MS = 4000;

/** Long enough that a crawler burst is cheap, short enough that a renamed deck corrects itself. */
const REVALIDATE_SECONDS = 300;

function apiBase(): string | null {
  const base = process.env.NEXT_PUBLIC_API_URL?.trim();
  return base ? base.replace(/\/$/, "") : null;
}

async function getJson<T>(path: string): Promise<T | null> {
  const base = apiBase();
  if (!base) return null;

  // The backend can be cold; a metadata fetch must not hold a response open indefinitely.
  const abort = AbortSignal.timeout(TIMEOUT_MS);
  try {
    const res = await fetch(`${base}${path}`, {
      signal: abort,
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    // Timed out, refused, or unparseable. The caller falls back to generic copy.
    return null;
  }
}

/** One shared deck, without its cards — see the backend's /summary for why that matters. */
export function fetchDeckSummary(deckId: string): Promise<PublicDeckSummary | null> {
  return getJson<PublicDeckSummary>(`/public/shared/${encodeURIComponent(deckId)}/summary`);
}

export function fetchProfile(username: string): Promise<AuthorPageResponse | null> {
  return getJson<AuthorPageResponse>(`/public/users/${encodeURIComponent(username)}`);
}

/** A page of the public directory — the sitemap's source of decks. */
export function fetchPublicDecks(limit: number, offset: number): Promise<PublicDeckPage | null> {
  return getJson<PublicDeckPage>(`/public/discover?limit=${limit}&offset=${offset}`);
}
