package com.ankiquiz.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "notes")
public class Note {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "deck_id", nullable = false)
    private UUID deckId;

    @Column(name = "note_type_id")
    private UUID noteTypeId;

    @Column(name = "anki_note_id")
    private String ankiNoteId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "fields", columnDefinition = "jsonb", nullable = false)
    private Map<String, String> fields;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "tags", columnDefinition = "text[]")
    private String[] tags;

    // Per-deck display order, set by import and the flashcard editor. Nullable for
    // any legacy row the V4 backfill somehow missed; ordering falls back to id.
    @Column(name = "note_position")
    private Integer position;

    // Per-card TTS language override per face (BCP-47 primary subtag). Null = fall
    // back to the deck-level default, then auto-detect. Set in the card editor.
    @Column(name = "front_lang")
    private String frontLang;

    @Column(name = "back_lang")
    private String backLang;

    // Per-face image (a Supabase Storage public URL). Null = no image. Parallel to
    // front_lang/back_lang; set in the card editor, shown in the flashcard viewer.
    @Column(name = "front_image_url")
    private String frontImageUrl;

    @Column(name = "back_image_url")
    private String backImageUrl;

    // Per-face audio pronunciation (a Supabase Storage public URL). Null = no
    // audio. Parallel to front_image_url/back_image_url; set in the card editor,
    // played by the in-card speaker (preferred over TTS when present).
    @Column(name = "front_audio_url")
    private String frontAudioUrl;

    @Column(name = "back_audio_url")
    private String backAudioUrl;

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getDeckId() {
        return deckId;
    }

    public void setDeckId(UUID deckId) {
        this.deckId = deckId;
    }

    public UUID getNoteTypeId() {
        return noteTypeId;
    }

    public void setNoteTypeId(UUID noteTypeId) {
        this.noteTypeId = noteTypeId;
    }

    public String getAnkiNoteId() {
        return ankiNoteId;
    }

    public void setAnkiNoteId(String ankiNoteId) {
        this.ankiNoteId = ankiNoteId;
    }

    public Map<String, String> getFields() {
        return fields;
    }

    public void setFields(Map<String, String> fields) {
        this.fields = fields;
    }

    public String[] getTags() {
        return tags;
    }

    public void setTags(String[] tags) {
        this.tags = tags;
    }

    public Integer getPosition() {
        return position;
    }

    public void setPosition(Integer position) {
        this.position = position;
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

    public String getFrontImageUrl() {
        return frontImageUrl;
    }

    public void setFrontImageUrl(String frontImageUrl) {
        this.frontImageUrl = frontImageUrl;
    }

    public String getBackImageUrl() {
        return backImageUrl;
    }

    public void setBackImageUrl(String backImageUrl) {
        this.backImageUrl = backImageUrl;
    }

    public String getFrontAudioUrl() {
        return frontAudioUrl;
    }

    public void setFrontAudioUrl(String frontAudioUrl) {
        this.frontAudioUrl = frontAudioUrl;
    }

    public String getBackAudioUrl() {
        return backAudioUrl;
    }

    public void setBackAudioUrl(String backAudioUrl) {
        this.backAudioUrl = backAudioUrl;
    }
}
