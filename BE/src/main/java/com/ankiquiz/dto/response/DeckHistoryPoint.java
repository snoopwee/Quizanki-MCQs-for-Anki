package com.ankiquiz.dto.response;

/**
 * One test's MCQ result for a deck (accuracy-over-time chart). A "test" is a quiz
 * session — all answers sharing a session id collapse into one point. Legacy
 * events with no session id (recorded before V8) collapse per calendar day.
 *
 * @param at       when the test finished, epoch milliseconds UTC (the FE renders it local)
 * @param answered graded answers in that test
 * @param correct  how many were right
 * @param accuracy correct / answered, 0–1
 */
public record DeckHistoryPoint(
        long at,
        long answered,
        long correct,
        double accuracy
) {
}
