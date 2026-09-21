package com.ankiquiz.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;
import java.util.UUID;

/** One deck filed in one folder (V26). A deck may appear in several folders. */
@Entity
@Table(name = "folder_decks")
@IdClass(FolderDeckId.class)
public class FolderDeck {

    @Id
    @Column(name = "folder_id")
    private UUID folderId;

    @Id
    @Column(name = "deck_id")
    private UUID deckId;

    @Column(name = "added_at")
    private OffsetDateTime addedAt;

    public UUID getFolderId() {
        return folderId;
    }

    public void setFolderId(UUID folderId) {
        this.folderId = folderId;
    }

    public UUID getDeckId() {
        return deckId;
    }

    public void setDeckId(UUID deckId) {
        this.deckId = deckId;
    }

    public OffsetDateTime getAddedAt() {
        return addedAt;
    }

    public void setAddedAt(OffsetDateTime addedAt) {
        this.addedAt = addedAt;
    }
}
