package com.ankiquiz.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import java.util.UUID;

public record StartSessionRequest(
        @NotNull UUID deckId,
        @Min(4) Integer questionCount,
        @Pattern(regexp = "FRONT_TO_BACK|BACK_TO_FRONT") String direction
) {
}
