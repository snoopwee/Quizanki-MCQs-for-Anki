package com.ankiquiz.dto.response;

import com.ankiquiz.entity.Deck;

import java.time.OffsetDateTime;
import java.util.UUID;

public record DeckResponse(
        UUID id,
        String name,
        String subdeckPath,
        String sourceFilename,
        Integer cardCount,
        OffsetDateTime importedAt,
        Double completion,
        // Deck-level primary TTS language per face (BCP-47 primary subtag), or null
        // to auto-detect. Set at import from the majority language of each face.
        String frontLang,
        String backLang
) {
    // For freshly-imported decks (no card_stats yet) completion is 0.
    public static DeckResponse from(Deck deck) {
        return from(deck, 0.0);
    }

    public static DeckResponse from(Deck deck, double completion) {
        return new DeckResponse(
                deck.getId(),
                deck.getName(),
                deck.getSubdeckPath(),
                deck.getSourceFilename(),
                deck.getCardCount(),
                deck.getImportedAt(),
                completion,
                deck.getFrontLang(),
                deck.getBackLang()
        );
    }
}
