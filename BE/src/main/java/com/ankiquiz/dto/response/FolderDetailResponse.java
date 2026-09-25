package com.ankiquiz.dto.response;

import java.util.List;
import java.util.UUID;

/**
 * One folder with what's in it. The decks are full {@link DeckResponse}s — the same shape Home
 * renders — so a folder view needs no second fetch and no special deck card.
 *
 * A deck filed here and later made private by its owner simply stops appearing; the filing is
 * left alone in case access comes back.
 */
public record FolderDetailResponse(
        UUID id,
        String name,
        List<DeckResponse> decks
) {
}
