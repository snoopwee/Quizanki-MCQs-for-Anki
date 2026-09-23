package com.ankiquiz.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * The rules for a public handle — the readable half of {@code /user/{username}}.
 *
 * <p>A handle is generated from what somebody is already called, not asked for at sign-up: the
 * auth flow is modal-first and includes OAuth, and interrupting it to demand a name nobody has
 * thought about yet costs more than it is worth. Anybody who dislikes theirs changes it in
 * Settings.
 *
 * <p>The id stays the app's identity. A handle is a label on top of it, so changing one can never
 * orphan a follow, a deck credit or a notification.
 */
public final class Usernames {

    /** Long enough to be distinctive, short enough to say out loud and fit in a URL bar. */
    public static final int MIN_LENGTH = 3;
    public static final int MAX_LENGTH = 30;

    /** Generated handles stop well short of the limit, leaving room for a collision suffix. */
    private static final int GENERATED_BASE_LENGTH = 24;

    private static final Pattern ALLOWED = Pattern.compile("^[a-zA-Z0-9][a-zA-Z0-9_.-]{2,29}$");
    private static final Pattern NOT_SLUGGABLE = Pattern.compile("[^a-z0-9]+");

    /**
     * Names nobody gets to take. Not route collisions — handles live under their own {@code /user/}
     * prefix, so they cannot shadow a page — but impersonation: a "quizanki" or "support" handle
     * would let somebody pass themselves off as us.
     */
    private static final Set<String> RESERVED = Set.of(
            "admin", "administrator", "quizanki", "support", "help", "helpdesk", "staff", "team",
            "moderator", "mod", "official", "system", "root", "api", "null", "undefined", "me",
            "anonymous", "deleted", "security", "billing", "abuse", "noreply", "everyone");

    private Usernames() {
    }

    /**
     * Turn a display name into a candidate handle, or "" when there is nothing usable in it —
     * which is the case for a blank name and also for a name written entirely in a non-Latin
     * script, since stripping it leaves nothing. Those fall back to {@link #fallbackFor}.
     */
    public static String slug(String displayName) {
        if (displayName == null) {
            return "";
        }
        String stripped = NOT_SLUGGABLE.matcher(displayName.toLowerCase(Locale.ROOT)).replaceAll("");
        if (stripped.length() > GENERATED_BASE_LENGTH) {
            stripped = stripped.substring(0, GENERATED_BASE_LENGTH);
        }
        // Too short to be a handle on its own — treat it as nothing and let the caller fall back,
        // rather than handing somebody a two-character name they cannot change away from quietly.
        return stripped.length() < MIN_LENGTH ? "" : stripped;
    }

    /**
     * A handle derived from the user id, for somebody whose name yields nothing sluggable.
     *
     * <p>Deterministic, and identical to what V35's backfill produces for the same row — the SQL
     * uses {@code md5(user_id)} too — so the same person gets the same handle whichever path
     * assigns it.
     */
    public static String fallbackFor(String userId) {
        return "user" + md5(userId).substring(0, 8);
    }

    /** The suffix a taken base gets. Per-user, so two people with the same base cannot collide. */
    public static String collisionSuffix(String userId) {
        return md5(userId).substring(0, 4);
    }

    /**
     * Why a requested handle is unacceptable, or null when it is fine. Returns the message rather
     * than throwing so the caller decides the status code.
     */
    public static String rejection(String requested) {
        if (requested == null || requested.isBlank()) {
            return "Pick a username.";
        }
        String trimmed = requested.trim();
        if (trimmed.length() < MIN_LENGTH) {
            return "Usernames are at least " + MIN_LENGTH + " characters.";
        }
        if (trimmed.length() > MAX_LENGTH) {
            return "Usernames are at most " + MAX_LENGTH + " characters.";
        }
        if (!ALLOWED.matcher(trimmed).matches()) {
            return "Usernames can use letters, numbers, and . _ - and must start with a letter or number.";
        }
        if (RESERVED.contains(trimmed.toLowerCase(Locale.ROOT))) {
            return "That username is reserved.";
        }
        return null;
    }

    private static String md5(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("MD5")
                    .digest((value == null ? "" : value).getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(digest.length * 2);
            for (byte b : digest) {
                hex.append(Character.forDigit((b >> 4) & 0xF, 16)).append(Character.forDigit(b & 0xF, 16));
            }
            return hex.toString();
        } catch (NoSuchAlgorithmException e) {
            // MD5 is required of every JVM. Used for a handle suffix, never for security.
            throw new IllegalStateException("MD5 unavailable", e);
        }
    }
}
