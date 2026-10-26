package com.ankiquiz.service.ai;

import com.ankiquiz.exception.AiUnavailableException;
import com.ankiquiz.exception.RateLimitExceededException;
import com.ankiquiz.service.ai.AiQuotaService.AiAccess;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.ZoneId;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Explaining one card. Nearly every assertion here is really about the CACHE, because the cache is
 * what decides whether this feature is affordable on a shared free-tier pool: a hit must cost no
 * quota and make no provider call, and a cache that is broken or switched off must degrade to
 * "works, just uncached" rather than to an error.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class CardExplanationServiceTest {

    private static final String USER = "user-1";
    private static final ZoneId ZONE = ZoneId.of("Asia/Bangkok");
    private static final String Q = "Mitochondrion";
    private static final String A = "The organelle that produces ATP.";

    @Mock AiProvider provider;
    @Mock AiQuotaService quota;
    @Mock AiUsageLogger usage;
    @Mock ExplanationCache cache;

    CardExplanationService service;

    @BeforeEach
    void setUp() {
        when(provider.name()).thenReturn("gemini");
        when(provider.model()).thenReturn("gemini-3.5-flash");
        when(quota.authorize(anyString(), any())).thenReturn(new AiAccess(AiAccess.SHARED, "k", 5));
        when(cache.pathFor(anyString(), anyString())).thenReturn("ab/abc.txt");
        when(cache.get(anyString())).thenReturn(Optional.empty());
        service = new CardExplanationService(provider, quota, usage, cache, 220, 2000);
    }

    @Test
    void aCacheHitCostsNoQuotaAndNeverReachesTheProvider() {
        when(cache.get("ab/abc.txt")).thenReturn(Optional.of("Because it makes ATP."));

        CardExplanationService.Explanation result = service.explain(USER, ZONE, Q, A);

        assertThat(result.text()).isEqualTo("Because it makes ATP.");
        assertThat(result.cached()).isTrue();
        // The two that make this feature affordable at all.
        verify(quota, never()).authorize(anyString(), any());
        verify(provider, never()).complete(any(), anyString());
        // Nothing was spent, so there is nothing to put in the usage ledger.
        verify(usage, never()).record(anyString(), anyString(), anyString(), anyString(), anyString(),
                anyInt(), anyInt(), anyString(), any());
    }

    @Test
    void aMissCallsTheProviderAndCachesTheAnswerForEverybodyAfter() {
        when(provider.complete(any(), anyString()))
                .thenReturn(new AiCompletion("ATP is made there.", 10, 20));

        CardExplanationService.Explanation result = service.explain(USER, ZONE, Q, A);

        assertThat(result.text()).isEqualTo("ATP is made there.");
        assertThat(result.cached()).isFalse();
        verify(cache).put("ab/abc.txt", "ATP is made there.");
        verify(usage).record(eq(USER), eq("explain"), eq("gemini"), anyString(), anyString(),
                anyInt(), eq(1), eq(AiUsageLogger.OUTCOME_OK), any());
    }

    @Test
    void aFailedCacheWriteStillReturnsTheAnswerTheLearnerJustPaidFor() {
        when(provider.complete(any(), anyString())).thenReturn(new AiCompletion("Prose.", 1, 2));
        when(cache.put(anyString(), anyString())).thenReturn(false);

        // Failing to cache costs the NEXT learner a call. It must not cost this one the answer.
        assertThat(service.explain(USER, ZONE, Q, A).text()).isEqualTo("Prose.");
    }

    @Test
    void asksForProseRatherThanJsonAndKeepsTheAnswerShort() {
        when(provider.complete(any(), anyString())).thenReturn(new AiCompletion("Prose.", 1, 2));

        service.explain(USER, ZONE, Q, A);

        org.mockito.ArgumentCaptor<AiPrompt> prompt = org.mockito.ArgumentCaptor.forClass(AiPrompt.class);
        verify(provider).complete(prompt.capture(), anyString());
        assertThat(prompt.getValue().jsonOutput()).isFalse();
        assertThat(prompt.getValue().maxOutputTokens()).isEqualTo(220);
        // Both halves reach the model, labelled — without the answer it cannot explain anything.
        assertThat(prompt.getValue().userText()).contains(Q).contains(A);
    }

    @Test
    void anEmptyCardIsRejectedWithoutSpendingAnything() {
        assertThatThrownBy(() -> service.explain(USER, ZONE, "   ", A))
                .isInstanceOf(AiUnavailableException.class);
        assertThatThrownBy(() -> service.explain(USER, ZONE, Q, ""))
                .isInstanceOf(AiUnavailableException.class);

        verify(quota, never()).authorize(anyString(), any());
        verify(provider, never()).complete(any(), anyString());
    }

    @Test
    void anEmptyModelAnswerIsAnErrorRatherThanAnEmptyBubble() {
        when(provider.complete(any(), anyString())).thenReturn(new AiCompletion("   ", 1, 0));

        assertThatThrownBy(() -> service.explain(USER, ZONE, Q, A))
                .isInstanceOf(AiUnavailableException.class);
        // Nothing worth caching, so the next learner gets a real attempt rather than a blank.
        verify(cache, never()).put(anyString(), anyString());
    }

    @Test
    void aSpentQuotaSurfacesAsRateLimitedAndMakesNoProviderCall() {
        when(quota.authorize(anyString(), any()))
                .thenThrow(new RateLimitExceededException("No generations left today."));

        assertThatThrownBy(() -> service.explain(USER, ZONE, Q, A))
                .isInstanceOf(RateLimitExceededException.class);
        verify(provider, never()).complete(any(), anyString());
    }

    @Test
    void aProviderFailureIsRecordedInTheLedgerAndRethrown() {
        when(provider.complete(any(), anyString()))
                .thenThrow(new AiUnavailableException("upstream died"));

        assertThatThrownBy(() -> service.explain(USER, ZONE, Q, A))
                .isInstanceOf(AiUnavailableException.class);

        verify(usage).record(eq(USER), eq("explain"), anyString(), anyString(), anyString(),
                anyInt(), eq(0), eq(AiUsageLogger.OUTCOME_PROVIDER_ERROR), anyString());
        verify(cache, never()).put(anyString(), anyString());
    }

    @Test
    void anOversizedCardIsClippedSoOneBadNoteCannotDrainTheDaysTokens() {
        CardExplanationService small = new CardExplanationService(provider, quota, usage, cache, 220, 50);
        when(provider.complete(any(), anyString())).thenReturn(new AiCompletion("Prose.", 1, 2));

        small.explain(USER, ZONE, "x".repeat(5_000), A);

        org.mockito.ArgumentCaptor<AiPrompt> prompt = org.mockito.ArgumentCaptor.forClass(AiPrompt.class);
        verify(provider).complete(prompt.capture(), anyString());
        // 50 chars of question + the labels and the answer — nowhere near the 5,000 sent in.
        assertThat(prompt.getValue().userText().length()).isLessThan(200);
    }

    @Test
    void aLedgerFailureDoesNotDestroyAnAnswerTheLearnerALREADYPaidFor() {
        // The production bug, 2026-10-23: ai_generations.source_kind had a CHECK constraint from
        // V25 permitting only 'text' and 'pdf', so recording an 'explain' row threw — AFTER the
        // model had answered. The learner spent a generation and got a 500 with nothing cached.
        // V42 widens the constraint; this asserts the ordering that makes the class of failure
        // harmless regardless.
        when(provider.complete(any(), anyString())).thenReturn(new AiCompletion("Because ATP.", 1, 2));
        org.mockito.Mockito.doThrow(new org.springframework.dao.DataIntegrityViolationException("check constraint"))
                .when(usage).record(anyString(), anyString(), anyString(), anyString(), anyString(),
                        anyInt(), anyInt(), anyString(), any());

        CardExplanationService.Explanation result = service.explain(USER, ZONE, Q, A);

        assertThat(result.text()).isEqualTo("Because ATP.");
        // And it still reached the cache, so the next learner pays nothing.
        verify(cache).put("ab/abc.txt", "Because ATP.");
    }

    @Test
    void theAnswerIsCachedBEFORETheLedgerIsWritten() {
        // Ordering is the point: the generation is already spent by now, so making it reusable
        // must not sit behind bookkeeping that might fail.
        when(provider.complete(any(), anyString())).thenReturn(new AiCompletion("Prose.", 1, 2));

        service.explain(USER, ZONE, Q, A);

        org.mockito.InOrder order = org.mockito.Mockito.inOrder(cache, usage);
        order.verify(cache).put(anyString(), anyString());
        order.verify(usage).record(anyString(), anyString(), anyString(), anyString(), anyString(),
                anyInt(), anyInt(), anyString(), any());
    }

    @Test
    void aTruncatedAnswerIsNeverCachedBecauseACacheEntryIsFOREVER() {
        // The production bug, 2026-10-26: every explanation came back cut off after 37-50
        // characters, because gemini-3.5-flash is a THINKING model and spent nearly all of the
        // 220-token budget reasoning before writing a word. The text was not blank, so nothing
        // noticed — it was simply returned. Had the cache bucket existed, half a sentence would
        // have been written once and served to everybody who ever met that card.
        when(provider.complete(any(), anyString()))
                .thenReturn(new AiCompletion("Mitochondria are known as the \"", 10, 220, "MAX_TOKENS"));

        assertThatThrownBy(() -> service.explain(USER, ZONE, Q, A))
                .isInstanceOf(AiUnavailableException.class);

        verify(cache, never()).put(anyString(), anyString());
    }

    @Test
    void anAnswerThatFinishedItsSentenceIsCachedAsBefore() {
        // The other half of the guard: only MAX_TOKENS is a truncation. A normal STOP must not be
        // mistaken for one, or the feature would reject every good answer it ever produced.
        when(provider.complete(any(), anyString()))
                .thenReturn(new AiCompletion("Because it makes ATP.", 10, 40, "STOP"));

        CardExplanationService.Explanation result = service.explain(USER, ZONE, Q, A);

        assertThat(result.text()).isEqualTo("Because it makes ATP.");
        verify(cache).put("ab/abc.txt", "Because it makes ATP.");
    }

    @Test
    void aProviderThatReportsNoFinishReasonIsTreatedAsFinished() {
        // Not every provider says why it stopped. Absent a reason, assume the answer is whole —
        // refusing everything unlabelled would break the feature for a provider that is fine.
        when(provider.complete(any(), anyString()))
                .thenReturn(new AiCompletion("Because it makes ATP.", 10, 40, null));

        assertThat(service.explain(USER, ZONE, Q, A).text()).isEqualTo("Because it makes ATP.");
        verify(cache).put(anyString(), anyString());
    }

    @Test
    void logsExplanationsUnderASourceKindTheDatabaseAccepts() {
        // Guards the V25/V42 constraint from the Java side: ai_generations_source_kind_check
        // permits exactly these. A new value here needs a migration, not just a constant.
        assertThat(CardExplanationService.SOURCE_KIND).isIn("text", "pdf", "explain");
    }
}
