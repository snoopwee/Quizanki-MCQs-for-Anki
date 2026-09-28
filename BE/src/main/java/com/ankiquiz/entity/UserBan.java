package com.ankiquiz.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * One suspension (V39). HISTORY, not a flag: a lifted ban keeps its row, because "banned twice
 * before" is exactly what an admin needs when deciding about a third time.
 *
 * <p>A row with {@code liftedAt == null} is a ban in force, and a partial unique index guarantees
 * there is at most one of those per person.
 */
@Entity
@Table(name = "user_bans")
public class UserBan {

    @Id
    @GeneratedValue
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private String userId;

    /** Never null — a suspension with no reason is what this table exists to prevent. */
    @Column(name = "reason", nullable = false)
    private String reason;

    @Column(name = "banned_at", nullable = false)
    private OffsetDateTime bannedAt;

    @Column(name = "banned_by", nullable = false)
    private String bannedBy;

    @Column(name = "lifted_at")
    private OffsetDateTime liftedAt;

    @Column(name = "lifted_by")
    private String liftedBy;

    @Column(name = "lift_note")
    private String liftNote;

    public boolean isInForce() {
        return liftedAt == null;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public OffsetDateTime getBannedAt() {
        return bannedAt;
    }

    public void setBannedAt(OffsetDateTime bannedAt) {
        this.bannedAt = bannedAt;
    }

    public String getBannedBy() {
        return bannedBy;
    }

    public void setBannedBy(String bannedBy) {
        this.bannedBy = bannedBy;
    }

    public OffsetDateTime getLiftedAt() {
        return liftedAt;
    }

    public void setLiftedAt(OffsetDateTime liftedAt) {
        this.liftedAt = liftedAt;
    }

    public String getLiftedBy() {
        return liftedBy;
    }

    public void setLiftedBy(String liftedBy) {
        this.liftedBy = liftedBy;
    }

    public String getLiftNote() {
        return liftNote;
    }

    public void setLiftNote(String liftNote) {
        this.liftNote = liftNote;
    }
}
