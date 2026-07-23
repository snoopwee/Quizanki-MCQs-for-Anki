package com.ankiquiz.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * Imports the whole flashcard deck: its note types and their notes. The
 * question/answer field choice is no longer part of the deck — it's made at test
 * time — so the request mirrors the {@code /public/parse-apkg} response shape.
 */
public record ImportDeckRequest(
        @NotBlank @Size(max = 200) String name,
        @Size(max = 500) String subdeckPath,
        @Size(max = 300) String sourceFilename,
        // Deck-level primary TTS language per face (BCP-47 primary subtag), computed
        // client-side from the majority language of each face. Null = auto-detect.
        @Size(max = 16) String frontLang,
        @Size(max = 16) String backLang,
        // Whether to publish the deck to Discover on save. The review screen
        // defaults its control to public, but a MISSING value here means private:
        // an older or third-party client must never publish a deck by omission.
        Boolean isPublic,
        @NotEmpty @Valid List<NoteTypeRequest> noteTypes
) {
}
