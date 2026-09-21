package com.ankiquiz.dto.response;

/**
 * One study session's result for a deck (accuracy-over-time chart). A session is a quiz or a
 * Learn session — all answers sharing a session id collapse into one point, Learn's repeat
 * answers included. Legacy events with no session id (recorded before V8) collapse per
 * calendar day.
 *
 * @param at       when the session finished, epoch milliseconds UTC (the FE renders it local)
 * @param answered graded answers in that session
 * @param correct  how many were right
 * @param accuracy correct / answered, 0–1
 * @param source   {@code "learn"} for a Learn session, otherwise {@code "quiz"}
 */
public record DeckHistoryPoint(
        long at,
        long answered,
        long correct,
        double accuracy,
        String source
) {
}
