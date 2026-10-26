package com.ankiquiz.service.ai;

/**
 * What came back. Token counts are whatever the provider reported (null when it reports none) and
 * are kept for the usage ledger, not for billing decisions.
 *
 * @param finishReason the provider's own word for why generation stopped — {@code "STOP"} when the
 *                     model finished its sentence, {@code "MAX_TOKENS"} when it ran out of budget
 *                     mid-answer. Null when the provider did not say.
 */
public record AiCompletion(
        String text,
        Integer inputTokens,
        Integer outputTokens,
        String finishReason
) {

    /** For callers and tests that do not care why generation stopped. */
    public AiCompletion(String text, Integer inputTokens, Integer outputTokens) {
        this(text, inputTokens, outputTokens, null);
    }

    /**
     * Whether the answer was cut off mid-thought rather than finished.
     *
     * <p>⚠ Worth knowing why this exists: on 2026-10-26 every explanation in production came back
     * truncated after 37–50 characters — "Mitochondria are known as the \"" — because
     * {@code maxOutputTokens} was 220 and <b>a thinking model spends that budget on reasoning
     * before it writes a word.</b> The text was not blank, so nothing noticed; it was simply
     * returned, and would have been cached forever had the cache bucket existed.
     *
     * <p>A truncated answer is not an answer. Callers must not cache it.
     */
    public boolean truncated() {
        return "MAX_TOKENS".equalsIgnoreCase(finishReason);
    }
}
