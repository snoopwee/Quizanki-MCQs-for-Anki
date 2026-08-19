package com.ankiquiz.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * A user's relationship to a deck (their library) — see V12. Keyed by
 * {@code (userId, deckId)}. {@code saved} is a bookmark to their Home;
 * {@code lastOpenedAt} drives the Recent tab.
 */
@Entity
@Table(name = "user_deck")
@IdClass(UserDeckId.class)
public class UserDeck {

    @Id
    @Column(name = "user_id")
    private String userId;

    @Id
    @Column(name = "deck_id")
    private UUID deckId;

    @Column(nullable = false)
    private boolean saved;

    @Column(name = "last_opened_at")
    private OffsetDateTime lastOpenedAt;

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

    public boolean isSaved() {
        return saved;
    }

    public void setSaved(boolean saved) {
        this.saved = saved;
    }

    public OffsetDateTime getLastOpenedAt() {
        return lastOpenedAt;
    }

    public void setLastOpenedAt(OffsetDateTime lastOpenedAt) {
        this.lastOpenedAt = lastOpenedAt;
    }
}
