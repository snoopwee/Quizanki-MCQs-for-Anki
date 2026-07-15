package com.ankiquiz.dto.request;

import jakarta.validation.constraints.Size;

/**
 * Deck-level TTS language edit (Flashcards Options modal). Sets the primary
 * language for the term (front) and definition (back) faces. Both are nullable —
 * a blank value clears the deck default back to auto-detect.
 */
public record SetDeckLanguagesRequest(
        @Size(max = 16) String frontLang,
        @Size(max = 16) String backLang
) {
}
