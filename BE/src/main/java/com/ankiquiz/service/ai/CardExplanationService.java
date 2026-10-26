package com.ankiquiz.service.ai;

import java.time.ZoneId;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.ankiquiz.exception.AiKeyInvalidException;
import com.ankiquiz.exception.AiUnavailableException;
import com.ankiquiz.exception.RateLimitExceededException;
import com.ankiquiz.service.ai.AiQuotaService.AiAccess;

/**
 * "Why is this the right answer?" for one card.
 *
 * <p>The smallest useful shape for AI help: a learner who just got a card wrong gets two or three
 * sentences explaining the answer, in place, without leaving the review screen.
 *
 * <p><b>Cached per card, and that is the point.</b> The explanation of a given question/answer
 * pair is the same for everybody, so the first learner to ask pays a model call and everyone after
 * them is served from storage for nothing. A cache HIT costs no quota and makes no provider call —
 * it does not even authorize, because there is nothing to spend. See {@link ExplanationCache} for
 * why that cache is object storage and not a table.
 */
@Service
public class CardExplanationService {

    private static final Logger log = LoggerFactory.getLogger(CardExplanationService.class);

    /** What the usage ledger calls these, alongside "text" and "pdf" from deck generation. */
    static final String SOURCE_KIND = "explain";

    /**
     * Deliberately strict. A learner wants the reason, not an essay: long answers cost more of a
     * shared pool, take longer to read, and are the usual way these features become noise. The
     * "no preamble" line matters — models love opening with "Great question!", which is a sentence
     * of nothing in a two-sentence budget.
     */
    private static final String SYSTEM_INSTRUCTION = """
            You explain flashcard answers to a student who just got one wrong.

            Given a QUESTION and its correct ANSWER, write 2-3 short sentences saying WHY that \
            answer is correct — the reasoning, the distinguishing detail, or a memory hook.

            Rules:
            - Plain prose. No preamble, no greeting, no restating the question, no sign-off.
            - Do not mention that you are an AI, a model, or that you were asked anything.
            - Never contradict the given answer. It is correct by definition here; if it looks \
            wrong to you, explain the sense in which it is meant rather than arguing.
            - If the material is too thin to explain, say so in one sentence.
            - Answer in the language of the question.
            """;

    private final AiProvider provider;
    private final AiQuotaService quota;
    private final AiUsageLogger usage;
    private final ExplanationCache cache;
    private final int maxOutputTokens;
    private final int maxInputChars;

    public CardExplanationService(
            AiProvider provider,
            AiQuotaService quota,
            AiUsageLogger usage,
            ExplanationCache cache,
            @Value("${ai.explain.max-output-tokens:220}") int maxOutputTokens,
            @Value("${ai.explain.max-input-chars:2000}") int maxInputChars
    ) {
        this.provider = provider;
        this.quota = quota;
        this.usage = usage;
        this.cache = cache;
        this.maxOutputTokens = maxOutputTokens;
        this.maxInputChars = maxInputChars;
    }

    /** An explanation plus whether it came from the cache — the FE shows nothing different, but
     *  it makes the cache's hit rate observable without a dashboard. */
    public record Explanation(String text, boolean cached) {
    }

    /**
     * @throws RateLimitExceededException the day's allowance is spent (only reachable on a miss)
     * @throws AiUnavailableException     the question or answer is empty, or the provider failed
     */
    public Explanation explain(String userId, ZoneId zone, String question, String answer) {
        String q = trim(question);
        String a = trim(answer);
        if (q.isEmpty() || a.isEmpty()) {
            // Not a provider problem, so it must not consume quota or reach the model.
            throw new AiUnavailableException("There's nothing on this card to explain.");
        }

        String path = cache.pathFor(q, a);
        Optional<String> hit = cache.get(path);
        if (hit.isPresent()) {
            return new Explanation(hit.get(), true);
        }

        AiAccess access = quota.authorize(userId, zone);
        String userText = "QUESTION:\n" + q + "\n\nANSWER:\n" + a;
        try {
            AiCompletion completion = provider.complete(
                    new AiPrompt(SYSTEM_INSTRUCTION, userText, maxOutputTokens, false),
                    access.apiKey());
            String text = trim(completion.text());
            if (text.isEmpty()) {
                throw new AiUnavailableException("The model returned an empty explanation.");
            }
            // Cache BEFORE bookkeeping. The generation has already been spent; writing it where
            // the next learner can find it is the thing that makes that spend worth something.
            cache.put(path, text);

            recordQuietly(userId, access, userText.length(), 1, AiUsageLogger.OUTCOME_OK, null);
            return new Explanation(text, false);
        } catch (RuntimeException ex) {
            recordQuietly(userId, access, userText.length(), 0, outcomeFor(ex),
                    ex.getClass().getSimpleName());
            log.warn("Explanation failed: {}", ex.getClass().getSimpleName());
            throw ex;
        }
    }

    /**
     * Writes the usage ledger, and <b>never lets it break the request</b>.
     *
     * <p>Learned the hard way in production on 2026-10-23: {@code source_kind} had a CHECK
     * constraint from V25 permitting only 'text' and 'pdf', so every explanation threw
     * DataIntegrityViolationException — <i>after</i> the model had already answered. The learner
     * spent a generation from a shared pool and got a 500 with nothing cached, so the next person
     * to ask the same question paid for it again. V42 widens the constraint, but the ordering was
     * the real defect: this is accounting, and accounting must not be able to destroy the thing
     * it is accounting for.
     *
     * <p>A lost ledger row understates usage, which is the cheap failure. Losing an answer the
     * user already paid for is the expensive one.
     */
    private void recordQuietly(String userId, AiAccess access, int inputChars, int cardsOut,
                               String outcome, String errorCode) {
        try {
            usage.record(userId, SOURCE_KIND, provider.name(), provider.model(), access.keyOwner(),
                    inputChars, cardsOut, outcome, errorCode);
        } catch (RuntimeException ledgerFailure) {
            log.error("Could not record AI usage ({}); serving the answer anyway", outcome,
                    ledgerFailure);
        }
    }

    /** Clipped so one pathological card cannot spend a large slice of the day's tokens. */
    private String trim(String value) {
        if (value == null) {
            return "";
        }
        String stripped = value.strip();
        return stripped.length() > maxInputChars ? stripped.substring(0, maxInputChars) : stripped;
    }

    private static String outcomeFor(RuntimeException ex) {
        if (ex instanceof AiKeyInvalidException) {
            return AiUsageLogger.OUTCOME_INVALID_KEY;
        }
        if (ex instanceof RateLimitExceededException) {
            return AiUsageLogger.OUTCOME_QUOTA;
        }
        return AiUsageLogger.OUTCOME_PROVIDER_ERROR;
    }
}
