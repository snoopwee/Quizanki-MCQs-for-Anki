import { fetchDeckSummary } from "@/lib/publicApi";
import { ogCard } from "@/lib/ogCard";
import { OG_CONTENT_TYPE, OG_SIZE } from "@/lib/ogText";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "A deck shared on Quizanki";

// The picture in a link preview of a shared deck. Next wires this to og:image and twitter:image
// for this route automatically — the metadata in layout.tsx doesn't name it.
export default async function Image({ params }: { params: Promise<{ deckId: string }> }) {
  const { deckId } = await params;
  const deck = await fetchDeckSummary(deckId);

  const facts: string[] = [];
  if (typeof deck?.cardCount === "number") {
    facts.push(`${deck.cardCount} ${deck.cardCount === 1 ? "card" : "cards"}`);
  }
  if (deck?.authorName) facts.push(`by ${deck.authorName}`);
  // Only once somebody has rated it — a "★ 0.0" on a preview card reads as a bad review.
  if (deck?.ratingCount && deck.ratingCount > 0) {
    facts.push(`★ ${(Math.round(deck.ratingAverage * 10) / 10).toFixed(1)} (${deck.ratingCount})`);
  }
  if (facts.length === 0) facts.push("Study it as a quiz, flashcards or a matching game");

  return ogCard({
    eyebrow: "Shared deck",
    // The backend may be asleep; a card that says nothing still beats no card at all.
    title: deck?.name?.trim() || "A shared deck",
    facts,
  });
}
