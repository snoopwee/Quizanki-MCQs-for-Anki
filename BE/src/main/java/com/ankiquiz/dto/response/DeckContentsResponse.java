package com.ankiquiz.dto.response;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * A saved deck's full flashcard structure: note types and their notes, in the
 * same shape as {@code /public/parse-apkg} so the client can reuse its flashcard
 * viewer and quiz setup. Each note carries its persisted UUID (for answer
 * recording) plus its original Anki note id.
 */
public record DeckContentsResponse(
        UUID id,
        String name,
        String subdeckPath,
        String sourceFilename,
        Integer cardCount,
        OffsetDateTime importedAt,
        Double completion,
        List<NoteTypeContents> noteTypes
) {
    public record NoteTypeContents(
            UUID id,
            Long ankiModelId,
            String name,
            boolean cloze,
            List<String> fieldNames,
            List<String> frontFields,
            List<String> backFields,
            int noteCount,
            List<NoteContents> notes
    ) {
    }

    public record NoteContents(
            UUID id,
            String ankiNoteId,
            Map<String, String> fields,
            List<String> tags
    ) {
    }
}
