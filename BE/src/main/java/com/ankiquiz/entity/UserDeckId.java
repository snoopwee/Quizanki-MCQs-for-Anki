package com.ankiquiz.entity;

import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

/** Composite key for {@link UserDeck}: (userId, deckId). */
public class UserDeckId implements Serializable {

    private String userId;
    private UUID deckId;

    public UserDeckId() {
    }

    public UserDeckId(String userId, UUID deckId) {
        this.userId = userId;
        this.deckId = deckId;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public UUID getDeckId() {
        return deckId;
    }

    public void setDeckId(UUID deckId) {
        this.deckId = deckId;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof UserDeckId that)) {
            return false;
        }
        return Objects.equals(userId, that.userId) && Objects.equals(deckId, that.deckId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(userId, deckId);
    }
}
