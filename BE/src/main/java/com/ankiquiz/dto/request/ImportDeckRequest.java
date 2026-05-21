package com.ankiquiz.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

public record ImportDeckRequest(
        @NotBlank @Size(max = 200) String name,
        @Size(max = 500) String subdeckPath,
        @NotBlank @Size(max = 100) String questionField,
        @NotBlank @Size(max = 100) String answerField,
        @DecimalMin("0.0") @DecimalMax("1.0") Double detectionConfidence,
        @NotEmpty @Valid List<NoteRequest> notes
) {
}
