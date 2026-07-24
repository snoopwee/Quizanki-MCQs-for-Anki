package com.ankiquiz.entity;

import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

/**
 * Composite key for {@link CardStats}: progress belongs to a (user, note) pair,
 * not to a note alone (see Flyway V11). Matches the two {@code @Id} fields on the
 * entity by name.
 */
public class CardStatsId implements Serializable {

    private String userId;
    private UUID noteId;

    public CardStatsId() {
    }

    public CardStatsId(String userId, UUID noteId) {
        this.userId = userId;
        this.noteId = noteId;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public UUID getNoteId() {
        return noteId;
    }

    public void setNoteId(UUID noteId) {
        this.noteId = noteId;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof CardStatsId that)) {
            return false;
        }
        return Objects.equals(userId, that.userId) && Objects.equals(noteId, that.noteId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(userId, noteId);
    }
}
