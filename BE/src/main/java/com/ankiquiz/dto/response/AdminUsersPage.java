package com.ankiquiz.dto.response;

import java.util.List;

/**
 * A page of users from the Supabase Admin API. GoTrue pages are 1-based;
 * {@code hasMore} is derived from a full page coming back, so the client can page
 * without depending on a total-count header.
 */
public record AdminUsersPage(
        List<AdminUserResponse> users,
        int page,
        int perPage,
        boolean hasMore
) {
}
