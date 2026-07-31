package com.ankiquiz.dto.response;

/**
 * One user in the admin user list, distilled from the Supabase (GoTrue) Admin API.
 * There's no user table locally — this is fetched live with the service-role key.
 * Timestamps are passed through as ISO strings (the client formats them);
 * {@code banned} reflects an active ban (a future {@code banned_until}).
 */
public record AdminUserResponse(
        String id,
        String email,
        String displayName,
        String createdAt,
        String lastSignInAt,
        boolean banned
) {
}
