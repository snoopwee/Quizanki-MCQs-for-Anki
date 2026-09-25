import type { Metadata } from "next";
import { fetchProfile } from "@/lib/publicApi";
import { profileDescription, profileTitle } from "@/lib/seo";
import { absoluteUrl } from "@/lib/siteUrl";

/**
 * Metadata for a public profile. In a layout for the same reason as the deck page: the page is a
 * client component, and a dynamic segment's layout gets the same `params`.
 *
 * The canonical is always the HANDLE form. `/authors/{uuid}` redirects here, and two URLs for one
 * page is exactly what a canonical exists to settle.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const profile = await fetchProfile(username);
  const canonical = absoluteUrl(`/user/${encodeURIComponent(username)}`);

  if (!profile) {
    return {
      title: "Learner",
      description: "A learner's public page on Quizanki.",
      robots: { index: false },
      alternates: { canonical },
    };
  }

  const title = profileTitle({
    username: profile.username ?? profile.authorName,
    deckCount: profile.deckCount,
    followers: profile.followers,
  });
  const description = profileDescription({
    username: profile.username ?? profile.authorName,
    deckCount: profile.deckCount,
    followers: profile.followers,
  });

  return {
    title,
    description,
    alternates: { canonical },
    // No `images` here on purpose: opengraph-image.tsx generates a proper 1200x630 card that
    // has the avatar IN it. A bare avatar is square and small, so it cropped badly as a banner.
    openGraph: { type: "profile", title, description, url: canonical },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default function UserProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
