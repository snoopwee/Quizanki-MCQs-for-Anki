import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/siteUrl";

// Static: the directory's own description doesn't change with its contents, and a crawler
// following the sitemap reaches each deck's page anyway.
const title = "Browse shared decks";
const description =
  "Public Anki decks shared by the Quizanki community — study any of them as a quiz, flashcards or a matching game.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: absoluteUrl("/discover") },
  openGraph: { type: "website", title, description, url: absoluteUrl("/discover") },
  twitter: { card: "summary", title, description },
};

export default function DiscoverLayout({ children }: { children: React.ReactNode }) {
  return children;
}
