package com.ankiquiz.service.ai;

import com.ankiquiz.entity.AiGeneration;
import com.ankiquiz.repository.AiGenerationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.OffsetDateTime;

/**
 * Appends one row per generation attempt. This ledger IS the quota — {@link AiQuotaService} counts
 * these rows — so a row must be written even when the attempt failed, and it must survive the
 * failure that produced it. Hence {@code REQUIRES_NEW}: the log commits on its own, so a rolled
 * back generation can't also roll back the evidence that it consumed pool budget.
 *
 * Nothing user-authored is stored: sizes and outcomes only, never the prompt or the cards.
 */
@Service
public class AiUsageLogger {

    public static final String OUTCOME_OK = "ok";
    public static final String OUTCOME_QUOTA = "quota";
    public static final String OUTCOME_PROVIDER_ERROR = "provider_error";
    public static final String OUTCOME_INVALID_INPUT = "invalid_input";
    public static final String OUTCOME_INVALID_KEY = "invalid_key";

    private final AiGenerationRepository repository;
    private final Clock clock;

    public AiUsageLogger(AiGenerationRepository repository, Clock clock) {
        this.repository = repository;
        this.clock = clock;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(
            String userId,
            String sourceKind,
            String provider,
            String model,
            String keyOwner,
            int inputChars,
            int cardsOut,
            String outcome,
            String errorCode
    ) {
        AiGeneration row = new AiGeneration();
        row.setUserId(userId);
        row.setSourceKind(sourceKind);
        row.setProvider(provider);
        row.setModel(model);
        row.setKeyOwner(keyOwner);
        row.setInputChars(inputChars);
        row.setCardsOut(cardsOut);
        row.setOutcome(outcome);
        row.setErrorCode(errorCode);
        row.setCreatedAt(OffsetDateTime.now(clock));
        repository.save(row);
    }
}
