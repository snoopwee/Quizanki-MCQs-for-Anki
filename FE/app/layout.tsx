import type { Metadata } from "next";
import { Space_Grotesk, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { TEXT_SIZE_INIT_SCRIPT } from "@/lib/textSize";

// Warm "study desk" type system (see FE/DESIGN_SYSTEM.md):
//   Space Grotesk — display / headings (tight, academic)
//   Geist         — body / UI
//   Geist Mono    — tags, stat captions, kbd hints
// Each is exposed as a CSS var and mapped onto a Tailwind token in globals.css
// (--font-display / --font-sans / --font-mono → font-display / font-sans / font-mono).
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Quizanki — Anki decks, as quizzes",
  description: "Turn your Anki flashcard decks into multiple-choice quizzes.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-theme="light"
      className={`${spaceGrotesk.variable} ${geist.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen antialiased" suppressHydrationWarning>
        {/* Resolve the saved theme onto <html> before first paint (no light flash
            on a dark-mode reload). Runs synchronously ahead of hydration; the
            `light` default above is overwritten here when the pref differs. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {/* Apply the saved Text size onto <html> before first paint too (no jump
            from 100% to a larger size on reload). Sets an inline font-size the
            same way the theme script sets data-theme. */}
        <script dangerouslySetInnerHTML={{ __html: TEXT_SIZE_INIT_SCRIPT }} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
