package com.ankiquiz.dto.response;

/**
 * One person who follows an author. <b>Only ever served to that author</b> — public follower
 * counts, private follower lists.
 *
 * <p>{@code displayName} can be null for somebody whose profile predates V33's backfill; the client
 * shows the id rather than dropping the row, because a follower who is hard to name is still a
 * follower.
 */
public record FollowerResponse(
        String userId,
        // The handle their row links to; null falls back to the /authors/{userId} URL.
        String username,
        String displayName,
        String avatarUrl
) {
}
