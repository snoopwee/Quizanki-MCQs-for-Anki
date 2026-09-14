package com.ankiquiz.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import java.util.UUID;

public record RecordAnswerRequest(
        @NotNull UUID noteId,
        @NotNull Boolean correct,
        // Which study surface produced the answer — mirrors answer_events.source (V21).
        // Optional so existing clients keep working; absent means a quiz answer. Deck-page
        // flashcards are preview only and never record, so there is no flashcards source.
        @Pattern(regexp = "quiz|learn") String source,
        // The client's IANA timezone (e.g. "Asia/Ho_Chi_Minh"), used to file today's study day
        // for the streak under the user's own calendar date. Optional and lenient: missing or
        // unknown falls back to UTC (ClientZone), so it can never block recording an answer.
        String timezone
) {
    public static final String DEFAULT_SOURCE = "quiz";

    /** The source to record: the request's, or {@code quiz} when omitted. */
    public String sourceOrDefault() {
        return source == null ? DEFAULT_SOURCE : source;
    }
}
