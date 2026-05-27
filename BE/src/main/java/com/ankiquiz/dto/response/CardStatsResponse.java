package com.ankiquiz.dto.response;

import com.ankiquiz.entity.CardStats;

import java.time.OffsetDateTime;

public record CardStatsResponse(
        Integer timesSeen,
        Integer timesCorrect,
        Double accuracy,
        Integer streak,
        OffsetDateTime lastSeenAt
) {
    public static CardStatsResponse from(CardStats stats) {
        return new CardStatsResponse(
                stats.getTimesSeen(),
                stats.getTimesCorrect(),
                stats.getAccuracy(),
                stats.getStreak(),
                stats.getLastSeenAt()
        );
    }
}
