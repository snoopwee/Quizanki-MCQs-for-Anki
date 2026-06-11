package com.ankiquiz.dto.request;

import jakarta.validation.constraints.NotEmpty;

import java.util.Map;

/**
 * Per-flashcard edit. Carries the full field map for the note; the service
 * keeps only keys that belong to the note's type and merges them over the
 * existing values, so a partial form can't introduce unknown fields.
 */
public record UpdateNoteRequest(
        @NotEmpty Map<String, String> fields
) {
}
