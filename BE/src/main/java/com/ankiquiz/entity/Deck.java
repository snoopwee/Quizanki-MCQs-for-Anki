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
}
