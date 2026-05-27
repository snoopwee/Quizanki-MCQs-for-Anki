package com.ankiquiz.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "card_stats")
public class CardStats {

    @Id
    @Column(name = "note_id")
    private UUID noteId;

    @Column(name = "times_seen")
    private Integer timesSeen;

    @Column(name = "times_correct")
    private Integer timesCorrect;

    @Column(name = "accuracy")
    private Double accuracy;

    @Column(name = "streak")
    private Integer streak;

    @Column(name = "last_seen_at")
    private OffsetDateTime lastSeenAt;

    public UUID getNoteId() {
        return noteId;
    }

    public void setNoteId(UUID noteId) {
        this.noteId = noteId;
    }

    public Integer getTimesSeen() {
        return timesSeen;
    }

    public void setTimesSeen(Integer timesSeen) {
        this.timesSeen = timesSeen;
    }

    public Integer getTimesCorrect() {
        return timesCorrect;
    }

    public void setTimesCorrect(Integer timesCorrect) {
        this.timesCorrect = timesCorrect;
    }

    public Double getAccuracy() {
        return accuracy;
    }

    public void setAccuracy(Double accuracy) {
        this.accuracy = accuracy;
    }

    public Integer getStreak() {
        return streak;
    }

    public void setStreak(Integer streak) {
        this.streak = streak;
    }

    public OffsetDateTime getLastSeenAt() {
        return lastSeenAt;
    }

    public void setLastSeenAt(OffsetDateTime lastSeenAt) {
        this.lastSeenAt = lastSeenAt;
    }
}
