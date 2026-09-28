import type { MetadataRoute } from "next";
import { fetchPublicDecks } from "@/lib/publicApi";
import { absoluteUrl } from "@/lib/siteUrl";

/** Discover's page size is capped server-side; this asks for the most it will give at a time. */
const PAGE_SIZE = 100;

/**
 * A ceiling on how much we will walk. A sitemap is allowed 50,000 URLs, but this is one request
 * per page against a backend that sleeps — better to list the newest 1,000 decks than to time out
 * listing all of them. Revisit by splitting into a sitemap index if the catalogue ever gets close.
 */
const MAX_DECKS = 1000;

/** Recrawl the directory often; a deck's own page rarely changes after it is shared. */
export const revalidate = 3600;

/**
 * Every page worth indexing: the landing page, Discover, each shared deck, and each author who has
 * published one.
 *
 * Authors are derived from the decks rather than listed separately — there is no public endpoint
 * enumerating users, and deliberately so. A profile earns a place here by having published
 * something, which is the same rule the author page itself follows.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/discover"), lastModified: now, changeFrequency: "daily", priority: 0.8 },
  ];

  const decks: MetadataRoute.Sitemap = [];
  const authors = new Map<string, Date | undefined>();

  for (let offset = 0; offset < MAX_DECKS; offset += PAGE_SIZE) {
    const page = await fetchPublicDecks(PAGE_SIZE, offset);
    // Unreachable backend: return what we have. A short sitemap is recoverable; a failed one
    // makes the whole route 500 and teaches a crawler to stop asking.
    if (!page || page.items.length === 0) break;

    for (const deck of page.items) {
      const shared = deck.sharedAt ? new Date(deck.sharedAt) : undefined;
      decks.push({
        url: absoluteUrl(`/shared/${deck.id}`),
        lastModified: shared && !Number.isNaN(shared.getTime()) ? shared : now,
        changeFrequency: "monthly",
        priority: 0.7,
      });

      // The handle form only — `/authors/{uuid}` is an alias that redirects, and a sitemap should
      // list the destination, not the door.
      if (deck.authorUsername) {
        const seen = authors.get(deck.authorUsername);
        if (!seen || (shared && shared > seen)) authors.set(deck.authorUsername, shared);
      }
    }

    if (page.items.length < PAGE_SIZE) break;
  }

  const profiles: MetadataRoute.Sitemap = Array.from(authors, ([username, lastShared]) => ({
    url: absoluteUrl(`/user/${encodeURIComponent(username)}`),
    lastModified: lastShared ?? now,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  return [...staticRoutes, ...decks, ...profiles];
}
