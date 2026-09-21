package com.ankiquiz.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;

/**
 * One AI generation attempt (V25) — the quota ledger and the usage evidence.
 *
 * Deliberately holds no user content: the prompt and the produced cards are not stored here, only
 * how big the input was and how many cards came back.
 */
@Entity
@Table(name = "ai_generations")
public class AiGeneration {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "user_id")
    private String userId;

    /** {@code text} or {@code pdf}. */
    @Column(name = "source_kind")
    private String sourceKind;

    @Column(name = "provider")
    private String provider;

    @Column(name = "model")
    private String model;

    /** {@code shared} (our free-tier key) or {@code user} (their own). */
    @Column(name = "key_owner")
    private String keyOwner;

    @Column(name = "input_chars")
    private Integer inputChars;

    @Column(name = "cards_out")
    private Integer cardsOut;

    /** {@code ok}, {@code quota}, {@code provider_error}, {@code invalid_input}, {@code invalid_key}. */
    @Column(name = "outcome")
    private String outcome;

    @Column(name = "error_code")
    private String errorCode;

    @Column(name = "created_at")
    private OffsetDateTime createdAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getSourceKind() {
        return sourceKind;
    }

    public void setSourceKind(String sourceKind) {
        this.sourceKind = sourceKind;
    }

    public String getProvider() {
        return provider;
    }

    public void setProvider(String provider) {
        this.provider = provider;
    }

    public String getModel() {
        return model;
    }

    public void setModel(String model) {
        this.model = model;
    }

    public String getKeyOwner() {
        return keyOwner;
    }

    public void setKeyOwner(String keyOwner) {
        this.keyOwner = keyOwner;
    }

    public Integer getInputChars() {
        return inputChars;
    }

    public void setInputChars(Integer inputChars) {
        this.inputChars = inputChars;
    }

    public Integer getCardsOut() {
        return cardsOut;
    }

    public void setCardsOut(Integer cardsOut) {
        this.cardsOut = cardsOut;
    }

    public String getOutcome() {
        return outcome;
    }

    public void setOutcome(String outcome) {
        this.outcome = outcome;
    }

    public String getErrorCode() {
        return errorCode;
    }

    public void setErrorCode(String errorCode) {
        this.errorCode = errorCode;
    }

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(OffsetDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
