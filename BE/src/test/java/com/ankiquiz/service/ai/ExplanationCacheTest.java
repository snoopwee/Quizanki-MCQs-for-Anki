package com.ankiquiz.service.ai;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The cache KEY, which is the only part of {@link ExplanationCache} that can be tested without a
 * Supabase bucket — and the part that matters most, because a key is a promise. Every explanation
 * in storage was paid for out of somebody's daily allowance, so a key that changes shape silently
 * orphans all of them: not a wrong answer, just a cache that quietly stops working and a bill
 * nobody notices. That is exactly how this feature was broken for weeks once before.
 */
class ExplanationCacheTest {

    /** Storage is never touched by {@code pathFor}, so blank config is fine here. */
    private final ExplanationCache cache = new ExplanationCache("", "", "explain-cache");

    @Test
    void englishKeysAreUNCHANGED_fromBeforeLanguageWasPartOfTheKey() {
        // ⚠ THIS IS THE REGRESSION GUARD. These two digests were computed from the deployed
        // implementation (separator "\n" + NUL + "\n", no language suffix) before the language
        // was introduced. If this test fails, every explanation already in the bucket has just
        // become unreachable — do not "fix" it by updating the expected value.
        assertThat(cache.pathFor("What makes ATP?", "The mitochondrion.", "en"))
                .isEqualTo("ae/ae6ef8ea9af552a9aea8768c82170d23a7ae4abd23172ff1150065fc59f12a80.txt");
    }

    @Test
    void anAbsentLanguageReadsTheSameEntryAsEnglish() {
        // A client that sends nothing gets English prose, so it must share English's entries or
        // every such request would be a miss that re-pays for an answer we already have.
        String english = cache.pathFor("Q", "A", "en");
        assertThat(cache.pathFor("Q", "A", null)).isEqualTo(english);
        assertThat(cache.pathFor("Q", "A", "")).isEqualTo(english);
        assertThat(cache.pathFor("Q", "A", "   ")).isEqualTo(english);
        assertThat(cache.pathFor("Q", "A", "EN")).isEqualTo(english);
    }

    @Test
    void adifferentLanguageIsADifferentEntry() {
        // The point of the whole change: one card, two languages, two explanations. Sharing a key
        // would serve Vietnamese prose to an English reader.
        assertThat(cache.pathFor("Q", "A", "vi"))
                .isNotEqualTo(cache.pathFor("Q", "A", "en"));
    }

    @Test
    void aLanguageIsCaseAndWhitespaceInsensitive() {
        String vi = cache.pathFor("Q", "A", "vi");
        assertThat(cache.pathFor("Q", "A", "VI")).isEqualTo(vi);
        assertThat(cache.pathFor("Q", "A", " vi ")).isEqualTo(vi);
    }

    @Test
    void theQuestionAnswerBoundaryCannotBeForged() {
        // The reason the separator is a NUL rather than a newline: card text can contain newlines,
        // so a newline separator would let ("a", "b\nc") and ("a\nb", "c") collide and one card
        // would serve the other's explanation. A NUL cannot occur in card text.
        assertThat(cache.pathFor("a", "b\nc", "en"))
                .isNotEqualTo(cache.pathFor("a\nb", "c", "en"));
    }

    @Test
    void formattingOnlyDifferencesShareOneExplanation() {
        // Whitespace is normalised on purpose: the model's answer would be identical, and a cache
        // that misses on a stray newline is a cache that mostly misses.
        String plain = cache.pathFor("What makes ATP?", "The mitochondrion.", "en");
        assertThat(cache.pathFor("  What   makes ATP?  ", "The\n\nmitochondrion.", "en"))
                .isEqualTo(plain);
    }

    @Test
    void theKeyIsShardedAndNamedConsistently() {
        String path = cache.pathFor("Q", "A", "en");
        // Two hex chars, a slash, the full 64-char digest, .txt — a flat directory with tens of
        // thousands of objects is slow to list and unpleasant to inspect.
        assertThat(path).matches("[0-9a-f]{2}/[0-9a-f]{64}\\.txt");
        assertThat(path).startsWith(path.substring(3, 5));
    }

    @Test
    void anEmptyCardStillProducesAUsableKey() {
        // pathFor is not the place that rejects empty cards (the service is), so it must not throw.
        assertThat(cache.pathFor("", "", "en")).matches("[0-9a-f]{2}/[0-9a-f]{64}\\.txt");
        assertThat(cache.pathFor(null, null, "en")).matches("[0-9a-f]{2}/[0-9a-f]{64}\\.txt");
    }
}
