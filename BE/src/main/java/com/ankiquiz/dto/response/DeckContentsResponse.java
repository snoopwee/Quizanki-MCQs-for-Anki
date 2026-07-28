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
 *
 * <p>{@code frontLang}/{@code backLang} at the deck level are the primary TTS
 * language for each face (term/definition); each {@link NoteContents} may carry a
 * per-card override of the same. All are nullable — null means auto-detect.
 */
public record DeckContentsResponse(
        UUID id,
        String name,
        String subdeckPath,
        String sourceFilename,
        Integer cardCount,
        OffsetDateTime importedAt,
        Double completion,
        String frontLang,
        String backLang,
        // True while the deck's share link is live. Always true on the public
        // shared-deck read (that read is gated on it).
        boolean isPublic,
        // Credit. `authorId` lets the client tell whether the viewer is the
        // credited author (which gates the share toggle); `sourceAuthorName` is
        // the "Original deck by X" line, null when this deck isn't a copy.
        String authorId,
        String authorName,
        // The author's profile picture (denormalised, kept current on rename), so
        // the deck page can show it next to the name. Null → the client shows initials.
        String authorAvatarUrl,
        String sourceAuthorName,
        // The VIEWER's relationship to the deck, so the client can pick the right
        // controls: `owned` = they own it (owner kebab: edit/share/export/delete);
        // otherwise `saved` drives the Save-to-Home toggle state. Both false on the
        // unauthenticated public read.
        boolean owned,
        boolean saved,
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
            List<String> tags,
            String frontLang,
            String backLang
    ) {
    }
}
