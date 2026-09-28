package com.ankiquiz.dto.response;

/**
 * One user in the admin user list, distilled from the Supabase (GoTrue) Admin API.
 * Identity is fetched live from Supabase with the service-role key; the suspension is ours
 * (V39), overlaid onto it. Timestamps are passed through as ISO strings (the client formats them).
 *
 * <p>{@code banned} no longer comes from Supabase's {@code banned_until}: bans moved into our own
 * database so the reason could be shown to the person suspended, and that reason is here.
 */
public record AdminUserResponse(
        String id,
        String email,
        String displayName,
        String createdAt,
        String lastSignInAt,
        boolean banned,
        // Why, and when — null when the account is in good standing.
        String banReason,
        String bannedAt
) {
}
