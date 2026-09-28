import { ImageResponse } from "next/og";
import { OG_COLORS, OG_SIZE, ogTitleSize } from "@/lib/ogText";

/**
 * The shared look for every generated link-preview card, so a deck and a profile are recognisably
 * the same product in a feed — which is the entire point of having them.
 *
 * Satori's constraints, all load-bearing below:
 *   * flexbox only — no grid, no float
 *   * any element with more than one child needs an explicit `display: flex`
 *   * inline styles only, no stylesheet and no CSS variables
 */

/**
 * One card: a terracotta rule along the top (the deck-card motif), an eyebrow, the title, a line of
 * facts, and the wordmark. `badge` is the optional round slot on the right — an avatar, or initials.
 */
export function ogCard(options: {
  eyebrow: string;
  title: string;
  facts: string[];
  badge?: { image: string | null; initials: string };
}): ImageResponse {
  const { eyebrow, title, facts, badge } = options;
  const titleSize = ogTitleSize(title);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: OG_COLORS.surface,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ height: 14, width: "100%", backgroundColor: OG_COLORS.accent, display: "flex" }} />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            flex: 1,
            padding: "56px 72px 48px 72px",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 40 }}>
            <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
              <div
                style={{
                  display: "flex",
                  fontSize: 26,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  color: OG_COLORS.accent,
                  fontWeight: 700,
                }}
              >
                {eyebrow}
              </div>
              <div
                style={{
                  display: "flex",
                  marginTop: 22,
                  fontSize: titleSize,
                  lineHeight: 1.1,
                  fontWeight: 700,
                  color: OG_COLORS.ink,
                }}
              >
                {title}
              </div>
            </div>

            {badge ? (
              badge.image ? (
                /* Satori rasterises this to a PNG — it is not a DOM image. `next/image` cannot
                   run here, and `alt` has no meaning in a picture; the card's own `alt` export
                   describes it. */
                /* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */
                <img
                  src={badge.image}
                  width={132}
                  height={132}
                  style={{ borderRadius: 66, border: `4px solid ${OG_COLORS.line}`, objectFit: "cover" }}
                />
              ) : (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 132,
                    height: 132,
                    borderRadius: 66,
                    border: `4px solid ${OG_COLORS.line}`,
                    backgroundColor: OG_COLORS.badgeBg,
                    color: OG_COLORS.accent,
                    fontSize: 52,
                    fontWeight: 700,
                  }}
                >
                  {badge.initials}
                </div>
              )
            ) : null}
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", gap: 28, fontSize: 30, color: OG_COLORS.muted }}>
              {facts.map((fact, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 28 }}>
                  {i > 0 ? <span style={{ color: OG_COLORS.line }}>•</span> : null}
                  <span style={{ color: fact.includes("★") ? OG_COLORS.warning : OG_COLORS.muted }}>{fact}</span>
                </div>
              ))}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                marginTop: 34,
                paddingTop: 28,
                borderTop: `2px solid ${OG_COLORS.line}`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: OG_COLORS.accent,
                  color: OG_COLORS.surface,
                  fontSize: 27,
                  fontWeight: 700,
                }}
              >
                Q
              </div>
              <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: OG_COLORS.ink }}>
                Quizanki
              </div>
              <div style={{ display: "flex", fontSize: 26, color: OG_COLORS.faint, marginLeft: 6 }}>
                Anki decks, as quizzes
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
