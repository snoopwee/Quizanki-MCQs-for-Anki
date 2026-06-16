package com.ankiquiz.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ApkgParseRateLimiterTest {

    // Mirrors the constant in ApkgParseRateLimiter (10 parses per 10-minute window).
    private static final int MAX_PER_WINDOW = 10;

    @Test
    void allowsUpToTheLimitThenBlocks() {
        ApkgParseRateLimiter limiter = new ApkgParseRateLimiter();

        for (int i = 1; i <= MAX_PER_WINDOW; i++) {
            assertThat(limiter.tryAcquire("1.2.3.4"))
                    .as("request %d within the window should be allowed", i)
                    .isTrue();
        }
        // The (MAX+1)th request inside the same window is rejected.
        assertThat(limiter.tryAcquire("1.2.3.4")).isFalse();
        assertThat(limiter.tryAcquire("1.2.3.4")).isFalse();
    }

    @Test
    void tracksEachIpIndependently() {
        ApkgParseRateLimiter limiter = new ApkgParseRateLimiter();

        // Exhaust one IP's budget completely.
        for (int i = 0; i < MAX_PER_WINDOW; i++) {
            limiter.tryAcquire("10.0.0.1");
        }
        assertThat(limiter.tryAcquire("10.0.0.1")).isFalse();

        // A different IP starts with a full budget.
        assertThat(limiter.tryAcquire("10.0.0.2")).isTrue();
    }
}
