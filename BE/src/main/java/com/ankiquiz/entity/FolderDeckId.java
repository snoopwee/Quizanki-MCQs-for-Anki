package com.ankiquiz.entity;

import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

/** Composite key for {@link FolderDeck} — (folder, deck), matching the table's primary key. */
public class FolderDeckId implements Serializable {

    private UUID folderId;
    private UUID deckId;

    public FolderDeckId() {
    }

    public FolderDeckId(UUID folderId, UUID deckId) {
        this.folderId = folderId;
        this.deckId = deckId;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof FolderDeckId that)) {
            return false;
        }
        return Objects.equals(folderId, that.folderId) && Objects.equals(deckId, that.deckId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(folderId, deckId);
    }
}
