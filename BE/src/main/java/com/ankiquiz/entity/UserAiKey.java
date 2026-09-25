package com.ankiquiz.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;

/**
 * A user's own provider API key (V25), encrypted at rest by {@code AiKeyCipher}.
 *
 * {@code keyCiphertext} must never leave the backend — not in a DTO, not in a log line. The UI
 * shows {@code keyHint} (the last four characters) so the owner can recognise which key is stored.
 */
@Entity
@Table(name = "user_ai_keys")
public class UserAiKey {

    @Id
    @Column(name = "user_id")
    private String userId;

    @Column(name = "provider")
    private String provider;

    @Column(name = "key_ciphertext")
    private String keyCiphertext;

    @Column(name = "key_hint")
    private String keyHint;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at")
    private OffsetDateTime updatedAt;

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getProvider() {
        return provider;
    }

    public void setProvider(String provider) {
        this.provider = provider;
    }

    public String getKeyCiphertext() {
        return keyCiphertext;
    }

    public void setKeyCiphertext(String keyCiphertext) {
        this.keyCiphertext = keyCiphertext;
    }

    public String getKeyHint() {
        return keyHint;
    }

    public void setKeyHint(String keyHint) {
        this.keyHint = keyHint;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(OffsetDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
