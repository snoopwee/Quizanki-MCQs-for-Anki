package com.ankiquiz.dto.response;

import java.util.List;
import java.util.Map;

/**
 * Parsed notes from a {@code .apkg}, grouped by note type. Each note's fields are
 * mapped to its own note type's field names and cleaned (HTML / {@code [sound:]}
 * stripped, entities decoded). Returns the deck's full note set so the client can
 * run field detection and build the quiz pool; a note whose model id has no
 * matching note type is counted in {@code skippedNotes}.
 *
 * <p>Each {@link ParsedNote} carries its Anki note id so the save path can upsert
 * by {@code ankiNoteId} (matching {@code NoteRequest}).
 *
 * <p>{@code frontFields}/{@code backFields} are the field names the deck author
 * placed on the card's question/answer side, derived from the note type's first
 * card template (legacy decks only). The client uses them to pre-select the quiz
 * prompt and answer; they're empty when no template is available (e.g. modern
 * decks whose template config is protobuf-encoded), and the client then falls
 * back to its own field-detection heuristic.
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
            List<String> frontFields,
            List<String> backFields,
            int noteCount,
            List<ParsedNote> notes
    ) {
    }

    public record ParsedNote(String ankiNoteId, Map<String, String> fields, List<String> tags) {
    }
}
