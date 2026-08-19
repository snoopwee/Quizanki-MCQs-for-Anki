package com.ankiquiz.dto.request;

import jakarta.validation.constraints.NotEmpty;

import java.util.List;
import java.util.Map;

public record NoteRequest(
        String ankiNoteId,
        @NotEmpty Map<String, String> fields,
        List<String> tags,
        // Per-face card image URL (null = none). Carried through import so a deck
        // imported with images (e.g. from an .apkg) keeps them on the cards.
        String frontImageUrl,
        String backImageUrl,
        // Per-face audio clip URL (null = none). Carried through import/clone so a
        // duplicated deck keeps its pronunciations.
        String frontAudioUrl,
        String backAudioUrl
) {
}
