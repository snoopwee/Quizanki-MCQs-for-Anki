package com.ankiquiz.dto.response;

import java.util.List;

/**
 * A public author page — this app's public profile page: who somebody is, and the decks they have
 * published. The name comes from their {@code profiles} row, falling back to a deck's denormalised
 * {@code author_name} for a row that predates V33.
 *
 * <p>An empty {@code decks} list is a real page, not an error: somebody who has published nothing
 * still has a name, a follower count and a Follow button. A user the app has never heard of is a
 * 404 instead. {@code authorName} can still be null for somebody who has never set a name.
 */
public record AuthorPageResponse(
        String authorId,
        // The public handle: this page's real URL is /user/{username}. The /authors/{id} URL stays
        // a permanent alias, and redirects here using this field.
        String username,
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
