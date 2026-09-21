package com.ankiquiz.service.ai;

/**
 * One text-in, text-out call to an AI provider — the seam that keeps the rest of the app from
 * knowing which provider is configured, and lets the generation logic (S2) be tested without a
 * network.
 *
 * Implementations must not log the API key or the prompt.
 */
public interface AiProvider {

    /** Provider id as stored in {@code ai_generations.provider} (e.g. {@code gemini}). */
    String name();

    /** The model id as stored in {@code ai_generations.model}. */
    String model();

    /**
     * @param apiKey live credential material — use it for this call and drop it
     * @throws com.ankiquiz.exception.AiKeyInvalidException     the provider rejected the key
     * @throws com.ankiquiz.exception.RateLimitExceededException the provider is rate-limiting us
     * @throws com.ankiquiz.exception.AiUnavailableException     anything else went wrong upstream
     */
    AiCompletion complete(AiPrompt prompt, String apiKey);
}
