import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { TEXT_SIZE_INIT_SCRIPT } from "@/lib/textSize";
import { siteUrl } from "@/lib/siteUrl";
import { getServerLocale } from "@/lib/i18n/server";

// Warm "study desk" type system (see FE/DESIGN_SYSTEM.md):
//   Space Grotesk — display / headings (tight, academic)
//   Geist         — body / UI
//   Geist Mono    — tags, stat captions, kbd hints
//
// SELF-HOSTED from public/fonts, declared in app/fonts.css and mapped onto the Tailwind
// tokens in globals.css. These came from `next/font/google` until 2026-11-16, which fetches
// from Google AT BUILD TIME and took CI down when the response could not be parsed. The full
// reasoning, and why all three fonts now ship a `vietnamese` subset, is in app/fonts.css.

export const metadata: Metadata = {
  // Absolute base for every relative URL below and in each route's own metadata. Open Graph tags
  // must be absolute, so without this a link preview gets no image and no canonical.
  metadataBase: new URL(siteUrl()),
  title: {
    default: "Quizanki — Anki decks, as quizzes",
    // Deck and profile pages set only their own name; the brand is appended once, here, so no
    // route has to remember to.
    template: "%s · Quizanki",
  },
  description: "Turn your Anki flashcard decks into multiple-choice quizzes.",
  applicationName: "Quizanki",
  openGraph: {
    type: "website",
    siteName: "Quizanki",
    title: "Quizanki — Anki decks, as quizzes",
    description: "Turn your Anki flashcard decks into multiple-choice quizzes.",
    url: "/",
  },
  twitter: {
    // No image yet, so a summary card: the large variant reserves a picture slot and renders a
    // grey box when there is none, which looks worse than the plain card.
    card: "summary",
    title: "Quizanki — Anki decks, as quizzes",
    description: "Turn your Anki flashcard decks into multiple-choice quizzes.",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Server-side so `lang` is correct in the FIRST response. A screen reader and Google both read
  // this attribute, and a Vietnamese page announcing itself as English is read with English
  // phonetics — which is worse than untranslated text.
  const locale = await getServerLocale();

  return (
    <html
      lang={locale}
      data-theme="light"
      suppressHydrationWarning
    >
      <body className="min-h-screen antialiased" suppressHydrationWarning>
        {/* Only the latin subsets are preloaded; unicode-range fetches the others when a
            page actually contains those characters. */}
        <link
          rel="preload"
          href="/fonts/geist-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/space-grotesk-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        {/* Resolve the saved theme onto <html> before first paint (no light flash
            on a dark-mode reload). Runs synchronously ahead of hydration; the
            `light` default above is overwritten here when the pref differs. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {/* Apply the saved Text size onto <html> before first paint too (no jump
            from 100% to a larger size on reload). Sets an inline font-size the
            same way the theme script sets data-theme. */}
        <script dangerouslySetInnerHTML={{ __html: TEXT_SIZE_INIT_SCRIPT }} />
        <Providers locale={locale}>{children}</Providers>
      </body>
    </html>
  );
}
