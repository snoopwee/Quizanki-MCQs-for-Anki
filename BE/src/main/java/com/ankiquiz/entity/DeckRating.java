package com.ankiquiz.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * One person's rating of one deck (V28).
 *
 * {@code stars} is public — it is what the deck's score is built from. {@code note} is NOT: it is
 * private feedback for the deck's author, and must never be copied into a response anyone else can
 * read. The author may clear the note; only its writer may change the stars.
 */
@Entity
@Table(name = "deck_ratings")
@IdClass(DeckRatingId.class)
public class DeckRating {

    @Id
    @Column(name = "deck_id", nullable = false)
    private UUID deckId;

    @Id
    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(nullable = false)
    private short stars;

    @Column
    private String note;

    /**
     * Opaque handle for this rating (V29), so the author can act on a note without its writer's
     * user id appearing in a URL. Deliberately NOT the identity — that is still (deckId, userId);
     * this is only an address. Named publicId rather than id so the two can never be confused.
     */
    @Column(name = "public_id", nullable = false)
    private UUID publicId;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    public UUID getDeckId() {
        return deckId;
    }

    public void setDeckId(UUID deckId) {
        this.deckId = deckId;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public short getStars() {
        return stars;
    }

    public void setStars(short stars) {
        this.stars = stars;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }

    public UUID getPublicId() {
        return publicId;
    }

    public void setPublicId(UUID publicId) {
        this.publicId = publicId;
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
