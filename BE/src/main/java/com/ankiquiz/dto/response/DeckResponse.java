package com.ankiquiz.dto.response;

import com.ankiquiz.entity.Deck;

import java.time.OffsetDateTime;
import java.util.UUID;

public record DeckResponse(
        UUID id,
        String name,
        String subdeckPath,
        String questionField,
        String answerField,
        Double detectionConfidence,
        Integer cardCount,
        OffsetDateTime importedAt
) {
    public static DeckResponse from(Deck deck) {
        return new DeckResponse(
                deck.getId(),
                deck.getName(),
                deck.getSubdeckPath(),
                deck.getQuestionField(),
                deck.getAnswerField(),
                deck.getDetectionConfidence(),
                deck.getCardCount(),
                deck.getImportedAt()
        );
    }
}
