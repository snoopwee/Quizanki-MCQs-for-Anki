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
    ANNOUNCEMENT("announcement"),

    /**
     * Somebody left a note with their rating of this author's deck. The author is the only person
     * who can read that note, so without this it would sit unseen.
     */
    DECK_REVIEWED("deck_reviewed"),

    /** An admin has dealt with something this user reported. */
    REPORT_REVIEWED("report_reviewed");

    private final String wire;

    NotificationKind(String wire) {
        this.wire = wire;
    }

    public String wire() {
        return wire;
    }
}
