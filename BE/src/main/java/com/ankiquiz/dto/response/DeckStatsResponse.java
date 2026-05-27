package com.ankiquiz.dto.response;

public record DeckStatsResponse(
        long totalCards,
        long seenCards,
        double averageAccuracy,
        long weakCards,
        long masteredCards
) {
}
