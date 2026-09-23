package com.ankiquiz.dto.request;

import jakarta.validation.constraints.Size;

/**
 * An author escalating a note on their deck. Both fields are optional — the note itself is the
 * evidence, and demanding an explanation before someone can report abuse aimed at them is a tax on
 * the wrong person.
 */
public record ReportNoteRequest(
        @Size(max = 60, message = "Keep the reason short")
        String reason,

        @Size(max = 500, message = "Keep the details under 500 characters")
        String details
) {
}
