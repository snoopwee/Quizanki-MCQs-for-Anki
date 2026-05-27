package com.ankiquiz.dto.request;

import jakarta.validation.constraints.NotEmpty;

import java.util.List;
import java.util.Map;

public record NoteRequest(
        String ankiNoteId,
        @NotEmpty Map<String, String> fields,
        List<String> tags
) {
}
