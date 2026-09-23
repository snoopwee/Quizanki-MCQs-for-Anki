package com.ankiquiz.dto.response;

import java.util.List;

/**
 * A public author page: who the author is (by their credited id + current name)
 * and the decks they've published. There's no user table, so the name is read off
 * their decks' denormalised {@code author_name} (kept current by the profile-rename
 * propagation). {@code authorName} is null / {@code deckCount} 0 when the author has
 * no public decks — the page then reads as "nothing to show".
 */
public record AuthorPageResponse(
        String authorId,
        String authorName,
        // The author's profile picture for the page header (null → initials).
        String authorAvatarUrl,
        long deckCount,
        // How many people follow them. Public: it sits under the name for everyone, guests
        // included. Whether YOU follow them is personal and comes from the authenticated
        // /authors/{id}/follow instead.
        long followers,
        List<PublicDeckSummary> decks
) {
}
