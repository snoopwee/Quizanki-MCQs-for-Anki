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
        Double completion
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
                completion
        );
    }
}
