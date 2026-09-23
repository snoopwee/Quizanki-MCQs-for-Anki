package com.ankiquiz.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;

/**
 * One kind of notification one person has switched off (V34).
 *
 * <p>The absence of a row is the default, and the default is "send". That is deliberate: somebody
 * who has never opened their settings has no rows here at all, and a kind added later is on for
 * everyone without a backfill.
 */
@Entity
@Table(name = "notification_mutes")
@IdClass(NotificationMuteId.class)
public class NotificationMute {

    @Id
    @Column(name = "user_id", nullable = false)
    private String userId;

    @Id
    @Column(nullable = false)
    private String kind;

    @Column(name = "muted_at", nullable = false)
    private OffsetDateTime mutedAt;

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getKind() {
        return kind;
    }

    public void setKind(String kind) {
        this.kind = kind;
    }

    public OffsetDateTime getMutedAt() {
        return mutedAt;
    }

    public void setMutedAt(OffsetDateTime mutedAt) {
        this.mutedAt = mutedAt;
    }
}
