package com.ankiquiz.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.UUID;

/**
 * Change which fields a deck's cards show, per note type — the "show/hide extra
 * fields" control on the deck / edit pages. Only the front/back field selection
 * changes; the notes themselves are untouched (unlike the full contents save).
 * Owner-only; drives the flashcard display and the quiz's default field picks.
 */
public record SetDeckLayoutRequest(
        @NotEmpty @Valid List<NoteTypeLayout> noteTypes
) {
    public record NoteTypeLayout(
            @NotNull UUID id,
            List<String> frontFields,
            List<String> backFields
    ) {
    }
}
