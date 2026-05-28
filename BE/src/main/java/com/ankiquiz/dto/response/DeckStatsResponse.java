package com.ankiquiz.dto.response;

public record DeckStatsResponse(
        long totalCards,
        long seenCards,
        double averageAccuracy,
        long weakCards,
        long masteredCards,
        // 0-100; mean of every note's mastery, unseen notes counted as 0.
        // This is the deck "completion" the dashboard surfaces.
        double averageMastery
) {
}
