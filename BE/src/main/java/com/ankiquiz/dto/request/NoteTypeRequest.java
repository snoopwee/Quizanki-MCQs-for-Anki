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
        @NotEmpty @Valid List<NoteRequest> notes
) {
}
