import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/siteUrl";

/**
 * What a crawler may index.
 *
 * Allowed: the landing page, Discover, shared decks and public profiles — everything a signed-out
 * visitor can already see.
 *
 * Disallowed: the signed-in app. Not for secrecy (it is auth-gated and a crawler gets redirected
 * anyway) but because those URLs are worthless in a search result — `/home` and `/settings` are
 * personal, and the study routes are a quiz engine, not a page.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/home", "/import", "/profile", "/settings", "/admin", "/decks", "/try", "/auth"],
    },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
