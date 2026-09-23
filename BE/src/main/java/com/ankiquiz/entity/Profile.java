package com.ankiquiz.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;

/**
 * What a person is called (V33). One row per user, written from their JWT on every {@code GET /me}.
 *
 * <p>Not to be confused with {@code decks.author_name} / {@code author_avatar_url}, which stay as a
 * CREDIT snapshot: a copy of someone else's deck keeps crediting the original author, which is a
 * different fact from what that person is called today.
 */
@Entity
@Table(name = "profiles")
public class Profile {

    @Id
    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "display_name")
    private String displayName;

    @Column(name = "avatar_url")
    private String avatarUrl;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getDisplayName() {
        return displayName;
    }

    public void setDisplayName(String displayName) {
        this.displayName = displayName;
    }

    public String getAvatarUrl() {
        return avatarUrl;
    }

    public void setAvatarUrl(String avatarUrl) {
        this.avatarUrl = avatarUrl;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(OffsetDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
