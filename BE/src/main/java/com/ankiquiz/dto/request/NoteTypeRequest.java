package com.ankiquiz.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * One note type (model) within an imported deck: its field list, the author's
 * front/back card layout, and the notes belonging to it.
 */
public record NoteTypeRequest(
        Long ankiModelId,
        @NotBlank @Size(max = 200) String name,
        boolean cloze,
        @NotEmpty List<String> fieldNames,
        List<String> frontFields,
        List<String> backFields,
        // Fields any card template renders (what Anki shows); fields in none are
        // metadata hidden by default. May be null/empty (older client, or a deck with
        // no template info) — then the client shows every field.
        List<String> templateFields,
        @NotEmpty @Valid List<NoteRequest> notes
) {
}
