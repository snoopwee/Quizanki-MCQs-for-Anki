package com.ankiquiz.dto.response;

/**
 * One author the caller follows, with enough to render a row: their name and avatar as the decks
 * credit them (both denormalised onto decks, kept current on rename), and how many public decks
 * they have now.
 *
 * <p>{@code authorName} is null for an author whose public decks have all gone — the follow
 * outlives them, and the client shows the id rather than pretending the row is broken.
 */
public record FollowedAuthorResponse(
        String authorId,
        String authorName,
        String authorAvatarUrl,
        long publicDecks
) {
}
