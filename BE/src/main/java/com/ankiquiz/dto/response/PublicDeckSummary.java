package com.ankiquiz.dto.response;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * One row of the public Discover directory. Deliberately a summary and not
 * {@link DeckContentsResponse}: the listing renders dozens of decks, and nobody
 * needs every card's fields to decide whether to open one.
 */
public record PublicDeckSummary(
        UUID id,
        String name,
        Integer cardCount,
        // The credited author's id — lets the client link the author name to their
        // author page (all their public decks).
        String authorId,
        String authorName,
        // The credited author's avatar (a Supabase Storage URL), or null → the
        // client shows initials. Denormalized onto the deck like authorName.
        String authorAvatarUrl,
        // "Original deck by X" — set when this deck started life as a copy.
        String sourceAuthorName,
        OffsetDateTime sharedAt
) {
}
