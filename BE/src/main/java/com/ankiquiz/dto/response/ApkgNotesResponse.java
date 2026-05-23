package com.ankiquiz.dto.response;

import java.util.List;
import java.util.Map;

/**
 * Chunk 4 response: notes extracted from the collection, grouped by note type.
 * Each note's fields are mapped to its own note type's field names and cleaned
 * (HTML / {@code [sound:]} stripped, entities decoded).
 *
 * <p>For reviewability this returns a small {@code sample} per note type plus the
 * full {@code noteCount}; the FE-ready version (later) returns all notes. A note
 * whose model id has no matching note type is counted in {@code skippedNotes}.
 */
public record ApkgNotesResponse(
        String filename,
        String collectionFile,
        String schema,
        int totalNotes,
        int skippedNotes,
        List<NoteTypeNotes> noteTypes
) {
    public record NoteTypeNotes(
            long id,
            String name,
            boolean cloze,
            List<String> fieldNames,
            int noteCount,
            List<ParsedNote> sample
    ) {
    }

    public record ParsedNote(Map<String, String> fields, List<String> tags) {
    }
}
