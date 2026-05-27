package com.ankiquiz.dto.request;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record RecordAnswerRequest(
        @NotNull UUID noteId,
        @NotNull Boolean correct
) {
}
