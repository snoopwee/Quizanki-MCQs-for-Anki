package com.ankiquiz.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Body of {@code POST /ai/decks/draft} — the material to turn into a draft deck.
 *
 * @param text     the learner's own notes. The hard cap here only bounds request memory; what we
 *                 actually send the provider is capped much lower by {@code ai.request.*}.
 * @param deckName optional; falls back to the material's first line
 * @param maxCards optional ceiling on how many cards to ask for
 * @param timezone the client's IANA timezone, for the daily quota's reset. A body field, never a
 *                 header — a custom header needs CORS to allow it and the two halves deploy
 *                 separately (the Phase 7 S2 lesson).
 */
public record AiDraftRequest(
        @NotBlank @Size(max = 200_000) String text,
        @Size(max = 120) String deckName,
        @Min(5) @Max(200) Integer maxCards,
        String timezone
) {
}
