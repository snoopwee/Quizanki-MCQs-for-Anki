import type { Metadata } from "next";
import { fetchDeckSummary } from "@/lib/publicApi";
import { deckDescription, deckTitle } from "@/lib/seo";
import { absoluteUrl } from "@/lib/siteUrl";

/**
 * Metadata for a shared deck — the link people actually paste.
 *
 * It lives in a layout rather than the page because the page is a client component (it runs the
 * study surfaces), and `generateMetadata` only exists on the server. A layout for a dynamic
 * segment receives the same `params`, so this needs no restructuring of the page at all.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ deckId: string }>;
}): Promise<Metadata> {
  const { deckId } = await params;
  const deck = await fetchDeckSummary(deckId);
  const canonical = absoluteUrl(`/shared/${deckId}`);

  // A deck that is private, deleted, or simply unreachable while the backend wakes up. Generic
  // copy beats a broken render, and `noindex` keeps a placeholder out of search results.
  if (!deck) {
    return {
      title: "Shared deck",
      description: "Study this deck as a quiz, flashcards or a matching game on Quizanki.",
      robots: { index: false },
      alternates: { canonical },
    };
  }

  const title = deckTitle(deck);
  const description = deckDescription(deck);

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { type: "article", title, description, url: canonical },
    // `summary_large_image` only became honest once opengraph-image.tsx existed — declaring it
    // without a picture makes X reserve the banner slot and render an empty grey block. The image
    // itself is wired up by the file convention, so it isn't named here.
    twitter: { card: "summary_large_image", title, description },
  };
}

export default function SharedDeckLayout({ children }: { children: React.ReactNode }) {
  return children;
}
