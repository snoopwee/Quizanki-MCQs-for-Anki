package com.ankiquiz.service.ai;

/**
 * What came back. Token counts are whatever the provider reported (null when it reports none) and
 * are kept for the usage ledger, not for billing decisions.
 */
public record AiCompletion(
        String text,
        Integer inputTokens,
        Integer outputTokens
) {
}
