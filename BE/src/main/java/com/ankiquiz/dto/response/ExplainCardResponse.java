package com.ankiquiz.dto.response;

/**
 * One card's explanation.
 *
 * @param explanation two or three sentences of prose. Plain text, not HTML or Markdown — it is
 *                    rendered as text, so a model that decides to emit asterisks shows asterisks
 *                    rather than becoming an injection surface.
 * @param cached      true when it was served from storage without a provider call. The UI treats
 *                    both the same; this exists so the cache's hit rate is observable from a
 *                    response rather than needing a dashboard.
 */
public record ExplainCardResponse(
        String explanation,
        boolean cached
) {
}
