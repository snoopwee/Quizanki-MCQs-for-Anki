package com.ankiquiz.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Body of {@code POST /ai/explain} — one card to explain.
 *
 * <p>The card's text is sent rather than a note id on purpose: the explanation is cached by
 * (question, answer), so the same card in a cloned or shared deck hits the same cache entry. A
 * note id would make every copy of a deck a fresh cache miss.
 *
 * @param question the prompt the learner saw
 * @param answer   the correct answer. Explaining is unconditional on this being right — the model
 *                 is told not to argue with it — so a deck with a wrong card gets a confident
 *                 explanation of a wrong thing. That is the deck's problem, not a reason to add a
 *                 fact-check the free tier cannot afford.
 * @param timezone the client's IANA timezone, for the daily quota's reset. A body field, never a
 *                 header — see {@link AiDraftRequest}.
 */
public record ExplainCardRequest(
        @NotBlank @Size(max = 5_000) String question,
        @NotBlank @Size(max = 5_000) String answer,
        String timezone
) {
}
