package com.ankiquiz.service;

import org.springframework.security.oauth2.jwt.Jwt;

import java.util.Map;

/**
 * The authenticated user, reduced to what deck authorship needs: their id and a
 * human name to credit them by.
 *
 * <p>There is no user table in this system — identity lives entirely in Supabase
 * {@code auth.users} — so the display name is read straight off the JWT and then
 * snapshotted onto the deck. Supabase access tokens carry both {@code email} and
 * the {@code user_metadata} object the profile page writes {@code display_name}
 * into, which is why no lookup against the Supabase Admin API is needed.
 *
 * <p>Resolution order: {@code display_name} → {@code full_name} → the local part
 * of the email → {@code "Anonymous"}. Each step is a fallback for a real case: an
 * OAuth sign-in populates {@code full_name} but not {@code display_name}, and a
 * token could carry neither.
 */
public record Caller(String id, String displayName, String avatarUrl) {

    public static final String ANONYMOUS = "Anonymous";

    public static Caller from(Jwt jwt) {
        return new Caller(jwt.getSubject(), resolveDisplayName(jwt), resolveAvatarUrl(jwt));
    }

    // The profile picture, mirroring the FE's avatarUrlOf: the user's uploaded
    // photo first, then an OAuth default (Google sets avatar_url/picture), else
    // null. Kept in sync with the deck's snapshot via PUT /me/author-profile.
    private static String resolveAvatarUrl(Jwt jwt) {
        Map<String, Object> metadata = userMetadata(jwt);
        return firstNonBlank(
                stringValue(metadata.get("custom_avatar_url")),
                stringValue(metadata.get("avatar_url")),
                stringValue(metadata.get("picture")));
    }

    private static String resolveDisplayName(Jwt jwt) {
        Map<String, Object> metadata = userMetadata(jwt);
        String name = firstNonBlank(
                stringValue(metadata.get("display_name")),
                stringValue(metadata.get("full_name")),
                stringValue(metadata.get("name")));
        if (name != null) {
            return name;
        }
        String email = jwt.getClaimAsString("email");
        if (email != null && email.contains("@")) {
            String local = email.substring(0, email.indexOf('@')).trim();
            if (!local.isEmpty()) {
                return local;
            }
        }
        return ANONYMOUS;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> userMetadata(Jwt jwt) {
        Object claim = jwt.getClaim("user_metadata");
        return claim instanceof Map<?, ?> map ? (Map<String, Object>) map : Map.of();
    }

    private static String stringValue(Object value) {
        if (!(value instanceof String s)) {
            return null;
        }
        String trimmed = s.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static String firstNonBlank(String... values) {
        for (String v : values) {
            if (v != null) {
                return v;
            }
        }
        return null;
    }
}
