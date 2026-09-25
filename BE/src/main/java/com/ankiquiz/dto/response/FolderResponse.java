package com.ankiquiz.dto.response;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * A folder in a list: enough to render the row, without loading the decks inside it.
 *
 * @param containsDeck only meaningful when the list was asked about one deck
 *                     ({@code GET /me/folders?deckId=…}), which is how the deck page shows
 *                     ticked folders without fetching every folder's contents. False otherwise.
 */
public record FolderResponse(
        UUID id,
        String name,
        int deckCount,
        OffsetDateTime updatedAt,
        boolean containsDeck
) {
}
