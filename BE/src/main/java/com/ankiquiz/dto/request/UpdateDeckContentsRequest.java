package com.ankiquiz.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Full desired state of a deck from the flashcard editor, committed in one Save.
 * The service reconciles this against the stored notes (update / insert / delete),
 * assigns each note's order from its index in {@code notes}, and applies any
 * front/back layout swaps. Last-write-wins — there is no version/conflict check.
 */
public record UpdateDeckContentsRequest(
        @NotBlank String name,
        @Valid List<NoteTypeLayout> noteTypes,
        @NotNull @Valid List<NoteEntry> notes
) {
    /** A note type whose front/back card layout may have changed (bulk swap). */
    public record NoteTypeLayout(
            @NotNull UUID id,
            List<String> frontFields,
            List<String> backFields
    ) {
    }

    /**
     * One card in display order. {@code id} null means a new card; {@code noteTypeId}
     * null (or unknown) routes it to the deck's Basic (Front/Back) type.
     * {@code frontLang}/{@code backLang} are the per-face TTS language override
     * (BCP-47 primary subtag); blank/null = inherit the deck default.
     * {@code frontImageUrl}/{@code backImageUrl} are the per-face card image URL;
     * blank/null = no image on that side. {@code frontAudioUrl}/{@code backAudioUrl}
     * are the per-face audio clip URL; blank/null = no audio on that side.
     */
    public record NoteEntry(
            UUID id,
            UUID noteTypeId,
            @NotEmpty Map<String, String> fields,
            List<String> tags,
            @Size(max = 16) String frontLang,
            @Size(max = 16) String backLang,
            @Size(max = 2000) String frontImageUrl,
            @Size(max = 2000) String backImageUrl,
            @Size(max = 2000) String frontAudioUrl,
            @Size(max = 2000) String backAudioUrl
    ) {
    }
}
