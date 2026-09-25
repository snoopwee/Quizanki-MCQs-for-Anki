package com.ankiquiz.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * An author escalating a note left on their deck (V30).
 *
 * {@code noteSnapshot} is the reported text, copied at report time: the author can clear the note
 * and the rater can delete their rating, either of which would leave an admin judging a report with
 * nothing to read. {@code ratingPublicId} is the note's opaque handle and deliberately has no
 * foreign key — a moderation record has to outlive the thing it is about.
 */
@Entity
@Table(name = "review_reports")
public class ReviewReport {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "rating_public_id", nullable = false)
    private UUID ratingPublicId;

    @Column(name = "deck_id", nullable = false)
    private UUID deckId;

    @Column(name = "reporter_id", nullable = false)
    private String reporterId;

    @Column
    private String reason;

    @Column
    private String details;

    @Column(name = "note_snapshot", nullable = false)
    private String noteSnapshot;

    /**
     * Who wrote the note (V31), snapshot at report time. NOT resolved through
     * {@code ratingPublicId} on demand: an admin takedown deletes the rating, so the moment they
     * moderate is the moment that route disappears — taking the obvious action would destroy what
     * the next one needs. Admin queue only; the author's feedback page never sees it.
     */
    @Column(name = "writer_id")
    private String writerId;

    /** What they were called at the time. Null when Supabase couldn't be reached. */
    @Column(name = "writer_name")
    private String writerName;

    @Column(nullable = false)
    private String status;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "resolved_at")
    private OffsetDateTime resolvedAt;

    @Column(name = "resolved_by")
    private String resolvedBy;

    /**
     * When this report becomes deletable (V37). Null while it is open — an open report is somebody's
     * outstanding work and never expires. Set when it is closed, swept by the scheduler.
     */
    @Column(name = "purge_after")
    private OffsetDateTime purgeAfter;

    /**
     * Why the admin acted (V38). Internal for resolve/dismiss; for a takedown it is also sent to
     * the person whose rating was removed. Null on rows that predate the requirement.
     */
    @Column(name = "resolution_note")
    private String resolutionNote;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getRatingPublicId() {
        return ratingPublicId;
    }

    public void setRatingPublicId(UUID ratingPublicId) {
        this.ratingPublicId = ratingPublicId;
    }

    public UUID getDeckId() {
        return deckId;
    }

    public void setDeckId(UUID deckId) {
        this.deckId = deckId;
    }

    public String getReporterId() {
        return reporterId;
    }

    public void setReporterId(String reporterId) {
        this.reporterId = reporterId;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public String getDetails() {
        return details;
    }

    public void setDetails(String details) {
        this.details = details;
    }

    public String getNoteSnapshot() {
        return noteSnapshot;
    }

    public void setNoteSnapshot(String noteSnapshot) {
        this.noteSnapshot = noteSnapshot;
    }

    public String getWriterId() {
        return writerId;
    }

    public void setWriterId(String writerId) {
        this.writerId = writerId;
    }

    public String getWriterName() {
        return writerName;
    }

    public void setWriterName(String writerName) {
        this.writerName = writerName;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public OffsetDateTime getResolvedAt() {
        return resolvedAt;
    }

    public void setResolvedAt(OffsetDateTime resolvedAt) {
        this.resolvedAt = resolvedAt;
    }

    public String getResolvedBy() {
        return resolvedBy;
    }

    public void setResolvedBy(String resolvedBy) {
        this.resolvedBy = resolvedBy;
    }

    public OffsetDateTime getPurgeAfter() {
        return purgeAfter;
    }

    public void setPurgeAfter(OffsetDateTime purgeAfter) {
        this.purgeAfter = purgeAfter;
    }

    public String getResolutionNote() {
        return resolutionNote;
    }

    public void setResolutionNote(String resolutionNote) {
        this.resolutionNote = resolutionNote;
    }
}
