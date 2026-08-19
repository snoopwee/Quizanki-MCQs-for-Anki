package com.ankiquiz.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;

/**
 * A content-addressed media blob stored in Supabase Storage (V18). One row per
 * distinct SHA-256, so identical card images/audio are stored once regardless of
 * who uploaded them. The row is the registry the backend checks to avoid
 * re-uploading, and the anchor for an orphan-GC sweep. No relationship to notes —
 * notes reference the object by its public URL (which ends in this {@code hash}).
 */
@Entity
@Table(name = "media_objects")
public class MediaObject {

    @Id
    private String hash;

    @Column(name = "bucket", nullable = false)
    private String bucket;

    @Column(name = "content_type", nullable = false)
    private String contentType;

    @Column(name = "byte_size", nullable = false)
    private long byteSize;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    public String getHash() {
        return hash;
    }

    public void setHash(String hash) {
        this.hash = hash;
    }

    public String getBucket() {
        return bucket;
    }

    public void setBucket(String bucket) {
        this.bucket = bucket;
    }

    public String getContentType() {
        return contentType;
    }

    public void setContentType(String contentType) {
        this.contentType = contentType;
    }

    public long getByteSize() {
        return byteSize;
    }

    public void setByteSize(long byteSize) {
        this.byteSize = byteSize;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
