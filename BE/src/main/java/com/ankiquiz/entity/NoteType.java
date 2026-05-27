package com.ankiquiz.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.UUID;

@Entity
@Table(name = "note_types")
public class NoteType {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "deck_id", nullable = false)
    private UUID deckId;

    @Column(name = "anki_model_id")
    private Long ankiModelId;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private boolean cloze;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "field_names", columnDefinition = "text[]", nullable = false)
    private String[] fieldNames;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "front_fields", columnDefinition = "text[]", nullable = false)
    private String[] frontFields;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "back_fields", columnDefinition = "text[]", nullable = false)
    private String[] backFields;

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

    public Long getAnkiModelId() {
        return ankiModelId;
    }

    public void setAnkiModelId(Long ankiModelId) {
        this.ankiModelId = ankiModelId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public boolean isCloze() {
        return cloze;
    }

    public void setCloze(boolean cloze) {
        this.cloze = cloze;
    }

    public String[] getFieldNames() {
        return fieldNames;
    }

    public void setFieldNames(String[] fieldNames) {
        this.fieldNames = fieldNames;
    }

    public String[] getFrontFields() {
        return frontFields;
    }

    public void setFrontFields(String[] frontFields) {
        this.frontFields = frontFields;
    }

    public String[] getBackFields() {
        return backFields;
    }

    public void setBackFields(String[] backFields) {
        this.backFields = backFields;
    }
}
