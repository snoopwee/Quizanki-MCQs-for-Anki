package com.ankiquiz.service.ai;

/**
 * What to ask the model.
 *
 * @param systemInstruction the standing instruction (what to produce, in what shape)
 * @param userText          the learner's material — never logged
 * @param maxOutputTokens   ceiling on the answer, so one oversized source can't drain the pool
 * @param jsonOutput        true to ask the provider for JSON rather than prose
 */
public record AiPrompt(
        String systemInstruction,
        String userText,
        int maxOutputTokens,
        boolean jsonOutput
) {
}
