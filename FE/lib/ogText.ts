/**
 * The non-visual half of the generated link-preview cards: sizes, the palette, and the helpers.
 *
 * Split from `ogCard.tsx` purely so it can be unit-tested — a test importing a module containing
 * JSX fails vitest's transform, since the project's tsconfig sets `jsx: preserve` for Next.
 */

/** What both X and Facebook crop to. An off-size image gets letterboxed or centre-cropped. */
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

// The app's own palette (globals.css), hard-coded because ImageResponse renders through Satori:
// no CSS variables, no Tailwind, no stylesheet.
export const OG_COLORS = {
  ink: "#2a2114",
  muted: "#574d3a",
  faint: "#6e6350",
  surface: "#fffdf6",
  line: "#e6dcc6",
  accent: "#d97757",
  warning: "#b07c17",
  badgeBg: "#f3e9d8",
} as const;

/**
 * Fetch an avatar and inline it as a data URI, because Satori cannot recover from a URL that is
 * slow or fails — the whole image 500s with it, and the preview then has no picture at all. A
 * short timeout and a null return let the caller fall back to initials, as the app itself does.
 */
export async function inlineImage(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "image/png";
    if (!type.startsWith("image/")) return null;
    return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
  } catch {
    return null;
  }
}

export function initialsOf(name: string | null | undefined): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const letters = words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[1][0];
  return letters.toUpperCase();
}

/**
 * Long deck names are common (`Japanese_Core_2000_Step_01_Listening…`) and Satori has no
 * line-clamp, so the title size steps down rather than overflowing the card.
 */
export function ogTitleSize(title: string): number {
  if (title.length > 68) return 54;
  if (title.length > 40) return 66;
  return 82;
}
