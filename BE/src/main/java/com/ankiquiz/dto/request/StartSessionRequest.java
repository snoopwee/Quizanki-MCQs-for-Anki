package com.ankiquiz.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import java.util.UUID;

public record StartSessionRequest(
        @NotNull UUID deckId,
        // Question count here is *how many MCQs are in the quiz*, not how many
        // options per question (which is fixed at 4 on the client). A 1-question
        // quiz is perfectly valid — e.g. testing a single weak card.
        @Min(1) Integer questionCount,
        @Pattern(regexp = "FRONT_TO_BACK|BACK_TO_FRONT") String direction
) {
}
