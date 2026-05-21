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

    @Column(name = "question_field", nullable = false)
    private String questionField;

    @Column(name = "answer_field", nullable = false)
    private String answerField;

    @Column(name = "detection_confidence")
    private Double detectionConfidence;

    @Column(name = "card_count")
    private Integer cardCount;

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

    public String getQuestionField() {
        return questionField;
    }

    public void setQuestionField(String questionField) {
        this.questionField = questionField;
    }

    public String getAnswerField() {
        return answerField;
    }

    public void setAnswerField(String answerField) {
        this.answerField = answerField;
    }

    public Double getDetectionConfidence() {
        return detectionConfidence;
    }

    public void setDetectionConfidence(Double detectionConfidence) {
        this.detectionConfidence = detectionConfidence;
    }

    public Integer getCardCount() {
        return cardCount;
    }

    public void setCardCount(Integer cardCount) {
        this.cardCount = cardCount;
    }

    public OffsetDateTime getImportedAt() {
        return importedAt;
    }

    public void setImportedAt(OffsetDateTime importedAt) {
        this.importedAt = importedAt;
    }
}
