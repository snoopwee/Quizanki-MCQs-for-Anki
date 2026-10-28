import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/siteUrl";
import { getServerT } from "@/lib/i18n/server";

// `generateMetadata` rather than a static `metadata` object, because the title and description
// are now translated and the language lives in a cookie only the server can read. This is the
// payoff for storing the locale in a cookie instead of localStorage: a Vietnamese reader gets a
// Vietnamese <title> and Open Graph description, not just a Vietnamese body.
//
// Still static in the other sense — the directory's description does not change with its
// contents, and a crawler following the sitemap reaches each deck's page anyway.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getServerT();
  const title = t("discover.metaTitle");
  const description = t("discover.metaDescription");

  return {
    title,
    description,
    alternates: { canonical: absoluteUrl("/discover") },
    openGraph: { type: "website", title, description, url: absoluteUrl("/discover") },
    twitter: { card: "summary", title, description },
  };
}

export default function DiscoverLayout({ children }: { children: React.ReactNode }) {
  return children;
}
