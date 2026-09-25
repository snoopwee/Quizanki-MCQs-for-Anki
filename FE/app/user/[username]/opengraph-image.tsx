import { fetchProfile } from "@/lib/publicApi";
import { ogCard } from "@/lib/ogCard";
import { OG_CONTENT_TYPE, OG_SIZE, inlineImage, initialsOf } from "@/lib/ogText";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "A learner's page on Quizanki";

export default async function Image({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const profile = await fetchProfile(username);
  const name = profile?.username?.trim() || profile?.authorName?.trim() || username;

  const decks = profile?.deckCount ?? 0;
  const followers = profile?.followers ?? 0;
  const facts: string[] = [
    decks === 0 ? "No public decks yet" : `${decks} public ${decks === 1 ? "deck" : "decks"}`,
  ];
  if (followers > 0) {
    facts.push(`${followers} ${followers === 1 ? "follower" : "followers"}`);
  }

  return ogCard({
    eyebrow: "Learner",
    title: name,
    facts,
    // Inlined rather than linked: Satori can't recover from a slow or failed fetch, and the whole
    // image would 500 with it. Initials are the same fallback the app itself uses.
    badge: { image: await inlineImage(profile?.authorAvatarUrl), initials: initialsOf(name) },
  });
}
