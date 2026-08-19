package com.ankiquiz.dto.request;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.Map;

/**
 * Per-flashcard edit. Carries the full field map for the note; the service
 * keeps only keys that belong to the note's type and merges them over the
 * existing values, so a partial form can't introduce unknown fields.
 *
 * <p>{@code frontLang}/{@code backLang} are the per-card TTS language override
 * for each face (BCP-47 primary subtag). They are always applied when present in
 * the request: a blank value clears the override back to the deck default.
 *
 * <p>{@code frontImageUrl}/{@code backImageUrl} are the per-face card image URL —
 * applied when present (blank clears the image); absent (null) leaves it unchanged.
 * {@code frontAudioUrl}/{@code backAudioUrl} are the per-face audio clip URL and
 * follow the identical present/blank/absent rule.
 */
public record UpdateNoteRequest(
        @NotEmpty Map<String, String> fields,
        @Size(max = 16) String frontLang,
        @Size(max = 16) String backLang,
        @Size(max = 2000) String frontImageUrl,
        @Size(max = 2000) String backImageUrl,
        @Size(max = 2000) String frontAudioUrl,
        @Size(max = 2000) String backAudioUrl
) {
}
