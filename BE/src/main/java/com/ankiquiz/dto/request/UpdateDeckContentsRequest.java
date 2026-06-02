package com.ankiquiz.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Full desired state of a deck from the flashcard editor, committed in one Save.
 * The service reconciles this against the stored notes (update / insert / delete),
 * assigns each note's order from its index in {@code notes}, and applies any
 * front/back layout swaps. Last-write-wins — there is no version/conflict check.
 */
public record UpdateDeckContentsRequest(
        @NotBlank String name,
        @Valid List<NoteTypeLayout> noteTypes,
        @NotNull @Valid List<NoteEntry> notes
) {
    /** A note type whose front/back card layout may have changed (bulk swap). */
    public record NoteTypeLayout(
            @NotNull UUID id,
            List<String> frontFields,
            List<String> backFields
    ) {
    }

    /**
     * One card in display order. {@code id} null means a new card; {@code noteTypeId}
     * null (or unknown) routes it to the deck's Basic (Front/Back) type.
     */
    public record NoteEntry(
            UUID id,
            UUID noteTypeId,
            @NotEmpty Map<String, String> fields,
            List<String> tags
    ) {
    }
}
