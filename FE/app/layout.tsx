import type { Metadata } from "next";
import { Fraunces } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

// Distinctive editorial serif for the wordmark and display headings; the body
// stays on the system sans. Exposed as a CSS var and used via the .font-display
// utility (see globals.css).
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
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
    <html lang="en" className={fraunces.variable}>
      <body className="min-h-screen antialiased" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
