package com.ankiquiz.dto.response;

/**
 * A generated draft deck, in the exact shape the {@code .apkg} parser returns — so the frontend
 * feeds it to the review editor it already has, and the model's output gets the same
 * check-before-save treatment as an imported file. Nothing is persisted until the learner saves.
 *
 * @param draft the cards, as a one-note-type (Front/Back) parse result
 * @param meta  what it cost and how complete it is
 */
public record AiDeckDraftResponse(
        ApkgNotesResponse draft,
        Meta meta
) {
    /**
     * @param keyOwner       {@code shared} (our free-tier pool) or {@code user} (their own key)
     * @param remainingToday generations left after this one, for the UI to show
     * @param chunks         how many provider calls this took
     * @param inputTruncated true when the material was longer than we were willing to send
     * @param partial        true when a later chunk failed and these are the cards we did get
     */
    public record Meta(
            String provider,
            String model,
            String keyOwner,
            int remainingToday,
            int cards,
            int chunks,
            boolean inputTruncated,
            boolean partial
    ) {
    }
}
