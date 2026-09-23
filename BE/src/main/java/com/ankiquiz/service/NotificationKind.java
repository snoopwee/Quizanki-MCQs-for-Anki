package com.ankiquiz.service;

/**
 * The kinds of notification the app can send. The wire value is what lands in
 * {@code notifications.kind} and what the client switches on, so it must stay in step with V27's
 * {@code notifications_kind_check} constraint — a new kind needs a migration as well as a value
 * here.
 */
public enum NotificationKind {

    /** Someone sent a deck to this user (Phase 11). */
    DECK_SHARED("deck_shared"),

    /** An author this user follows published a deck (Phase 11). */
    AUTHOR_PUBLISHED("author_published"),

    /** The team is speaking — an admin broadcast (Phase 10 S5). No actor. */
    ANNOUNCEMENT("announcement", false),

    /**
     * Somebody left a note with their rating of this author's deck. The author is the only person
     * who can read that note, so without this it would sit unseen.
     */
    DECK_REVIEWED("deck_reviewed"),

    /** An admin has dealt with something this user reported. */
    REPORT_REVIEWED("report_reviewed", false),

    /** Somebody started following this author. */
    NEW_FOLLOWER("new_follower");

    private final String wire;
    private final boolean mutable;

    NotificationKind(String wire) {
        this(wire, true);
    }

    NotificationKind(String wire, boolean mutable) {
        this.wire = wire;
        this.mutable = mutable;
    }

    public String wire() {
        return wire;
    }

    /**
     * Whether a person may switch this kind off.
     *
     * <p>Most kinds are theirs to decide. An admin announcement is not — it is operational, rare,
     * and the one channel the team has. Neither is the answer to a report somebody filed
     * themselves: they asked, so they get told.
     */
    public boolean mutable() {
        return mutable;
    }

    /** The wire value, or empty when it is not a kind this app knows. */
    public static java.util.Optional<NotificationKind> fromWire(String wire) {
        for (NotificationKind kind : values()) {
            if (kind.wire.equals(wire)) {
                return java.util.Optional.of(kind);
            }
        }
        return java.util.Optional.empty();
    }
}
