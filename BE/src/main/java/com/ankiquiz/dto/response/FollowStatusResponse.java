package com.ankiquiz.dto.response;

/**
 * The follow state of one author, from the caller's point of view.
 *
 * @param following  whether the caller follows them.
 * @param followers  how many people do. Public either way — it sits under the author's name.
 * @param self       true when the caller IS the author, so the client shows no button at all
 *                   rather than one that would be refused.
 */
public record FollowStatusResponse(
        boolean following,
        long followers,
        boolean self
) {
}
