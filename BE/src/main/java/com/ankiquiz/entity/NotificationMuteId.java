package com.ankiquiz.entity;

import java.io.Serializable;
import java.util.Objects;

/** Composite key for {@link NotificationMute}: one row per (person, kind they switched off). */
public class NotificationMuteId implements Serializable {

    private String userId;
    private String kind;

    public NotificationMuteId() {
    }

    public NotificationMuteId(String userId, String kind) {
        this.userId = userId;
        this.kind = kind;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof NotificationMuteId other)) {
            return false;
        }
        return Objects.equals(userId, other.userId) && Objects.equals(kind, other.kind);
    }

    @Override
    public int hashCode() {
        return Objects.hash(userId, kind);
    }
}
