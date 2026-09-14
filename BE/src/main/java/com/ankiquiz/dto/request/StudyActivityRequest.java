package com.ankiquiz.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

/**
 * Body of {@code POST /me/activity} — marks today as a study day for study that records no
 * graded answer, such as going through deck-page flashcards (which never touch mastery).
 */
public record StudyActivityRequest(
        @NotNull @Pattern(regexp = "quiz|learn|flashcards") String source,
        // The client's IANA timezone. Lenient: missing or unknown falls back to UTC (ClientZone).
        String timezone
) {
}
