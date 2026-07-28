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
        String backLang,
        // True while the deck's share link is live — anyone holding the link can
        // preview it and clone it into their own account.
        boolean isPublic,
        // Who is credited for the deck. Not the same as the owner: a copy is owned
        // by whoever took it but keeps crediting the original author until they
        // edit it. `sourceAuthorName` is the "Original deck by X" line (null when
        // this deck isn't a copy).
        String authorId,
        String authorName,
        // The author's profile picture (denormalised, kept current on rename), so
        // Home / deck cards can show it next to the name. Null → the client shows
        // initials.
        String authorAvatarUrl,
        String sourceAuthorName
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
                deck.getBackLang(),
                deck.isPublic(),
                deck.getAuthorId(),
                deck.getAuthorName(),
                deck.getAuthorAvatarUrl(),
                deck.getSourceAuthorName()
        );
    }
}
