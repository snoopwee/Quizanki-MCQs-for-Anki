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

    /**
     * The public handle in {@code /user/{username}} (V35). Unique case-insensitively, and
     * GENERATED rather than supplied — see {@link com.ankiquiz.service.Usernames}. Nullable only
     * as a transient state: every row written gets one on the way in.
     */
    @Column(name = "username")
    private String username;

    /**
     * Whether the handle above is theirs or ours (V36). False means we generated it and they have
     * never seen it, which is what makes the client ask them to confirm it once.
     */
    @Column(name = "username_chosen", nullable = false)
    private boolean usernameChosen;

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

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public boolean isUsernameChosen() {
        return usernameChosen;
    }

    public void setUsernameChosen(boolean usernameChosen) {
        this.usernameChosen = usernameChosen;
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
