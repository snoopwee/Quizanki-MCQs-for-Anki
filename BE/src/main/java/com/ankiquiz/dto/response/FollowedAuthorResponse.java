package com.ankiquiz.dto.response;

/**
 * One author the caller follows, with enough to render a row: who they are, and how many public
 * decks they have now.
 *
 * <p>{@code username} is what the row links to ({@code /user/{username}}); {@code authorId} is the
 * identity behind it and the fallback URL when somebody has no handle yet.
 *
 * <p>{@code authorName} is null for somebody who has never set a name — the row stays anyway,
 * because a follow outlives both their decks and their indecision about what to be called.
 */
public record FollowedAuthorResponse(
        String authorId,
        String username,
        String authorName,
        String authorAvatarUrl,
        long publicDecks
) {
}
