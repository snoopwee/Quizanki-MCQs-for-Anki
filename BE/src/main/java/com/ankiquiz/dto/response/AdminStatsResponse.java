package com.ankiquiz.dto.response;

/**
 * Site-wide totals for the admin overview dashboard. Everything here is derivable
 * from our own tables — a true registered-user count needs the Supabase Admin API
 * (there's no user table), so we report the two we can measure honestly:
 * {@code creators} (users who own ≥1 deck) and {@code learners} (users who've
 * studied ≥1 card). The real signup total arrives with the users phase.
 */
public record AdminStatsResponse(
        long decks,
        long publicDecks,
        long notes,
        long creators,
        long learners,
        long answers,
        long decksLast30Days,
        long answersLast7Days
) {
}
