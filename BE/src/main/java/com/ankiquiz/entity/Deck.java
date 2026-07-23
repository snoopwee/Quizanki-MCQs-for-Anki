package com.ankiquiz.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "decks")
public class Deck {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(nullable = false)
    private String name;

    @Column(name = "subdeck_path")
    private String subdeckPath;

    @Column(name = "source_filename")
    private String sourceFilename;

    @Column(name = "card_count")
    private Integer cardCount;

    // Deck-level primary TTS language per face (BCP-47 primary subtag, e.g. "ja").
    // Null = auto-detect. Set at import from the majority language of that face.
    @Column(name = "front_lang")
    private String frontLang;

    @Column(name = "back_lang")
    private String backLang;

    @Column(name = "imported_at")
    private OffsetDateTime importedAt;

    // Sharing (V9). While is_public is true the deck is readable by anyone with
    // its link, who can clone it into their own account. Off by default.
    @Column(name = "is_public", nullable = false)
    private boolean isPublic;

    @Column(name = "shared_at")
    private OffsetDateTime sharedAt;

    // The deck this one was cloned from, if any. No FK: deleting the original
    // must not touch the copies.
    @Column(name = "clone_source_deck_id")
    private UUID cloneSourceDeckId;

    // Authorship (V10). Who is CREDITED — not the same as userId, who owns the
    // row: a copy is owned by whoever took it while still crediting the original
    // author, until they make it theirs by editing it.
    @Column(name = "author_id", nullable = false)
    private String authorId;

    // Denormalised display name (there is no user table to join). Snapshotted
    // from the caller's JWT and re-stamped whenever the author writes the deck.
    @Column(name = "author_name")
    private String authorName;

    // Who this was copied from, for the "Original deck by X" line. Also
    // denormalised so it survives the original deck being deleted.
    @Column(name = "source_author_name")
    private String sourceAuthorName;

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

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getSubdeckPath() {
        return subdeckPath;
    }

    public void setSubdeckPath(String subdeckPath) {
        this.subdeckPath = subdeckPath;
    }

    public String getSourceFilename() {
        return sourceFilename;
    }

    public void setSourceFilename(String sourceFilename) {
        this.sourceFilename = sourceFilename;
    }

    public Integer getCardCount() {
        return cardCount;
    }

    public void setCardCount(Integer cardCount) {
        this.cardCount = cardCount;
    }

    public String getFrontLang() {
        return frontLang;
    }

    public void setFrontLang(String frontLang) {
        this.frontLang = frontLang;
    }

    public String getBackLang() {
        return backLang;
    }

    public void setBackLang(String backLang) {
        this.backLang = backLang;
    }

    public OffsetDateTime getImportedAt() {
        return importedAt;
    }

    public void setImportedAt(OffsetDateTime importedAt) {
        this.importedAt = importedAt;
    }

    public boolean isPublic() {
        return isPublic;
    }

    public void setPublic(boolean isPublic) {
        this.isPublic = isPublic;
    }

    public OffsetDateTime getSharedAt() {
        return sharedAt;
    }

    public void setSharedAt(OffsetDateTime sharedAt) {
        this.sharedAt = sharedAt;
    }

    public UUID getCloneSourceDeckId() {
        return cloneSourceDeckId;
    }

    public void setCloneSourceDeckId(UUID cloneSourceDeckId) {
        this.cloneSourceDeckId = cloneSourceDeckId;
    }

    public String getAuthorId() {
        return authorId;
    }

    public void setAuthorId(String authorId) {
        this.authorId = authorId;
    }

    public String getAuthorName() {
        return authorName;
    }

    public void setAuthorName(String authorName) {
        this.authorName = authorName;
    }

    public String getSourceAuthorName() {
        return sourceAuthorName;
    }

    public void setSourceAuthorName(String sourceAuthorName) {
        this.sourceAuthorName = sourceAuthorName;
    }
}
