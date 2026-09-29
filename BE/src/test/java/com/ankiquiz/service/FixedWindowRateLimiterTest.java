package com.ankiquiz.service;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The shared fixed-window mechanism. The assertion that matters most is the last one: a flood of
 * new keys must not reset the counters of callers already being limited.
 */
class FixedWindowRateLimiterTest {

    /** A limiter with a tiny key budget, so the crowding path is reachable in a test. */
    private static final class TinyLimiter extends FixedWindowRateLimiter {
        TinyLimiter(Clock clock) {
            super(2, 1000L, 3, clock);
        }
    }

    /** A clock we can wind forward without sleeping. */
    private static final class MovableClock extends Clock {
        private Instant now = Instant.parse("2026-09-29T00:00:00Z");

        void advance(Duration d) {
            now = now.plus(d);
        }

        @Override public ZoneOffset getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(java.time.ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
    }

    @Test
    void allowsUpToTheLimitThenBlocks() {
        TinyLimiter limiter = new TinyLimiter(new MovableClock());

        assertThat(limiter.tryAcquire("a")).isTrue();
        assertThat(limiter.tryAcquire("a")).isTrue();
        assertThat(limiter.tryAcquire("a")).isFalse();
    }

    @Test
    void theWindowResetsOnceItHasElapsed() {
        MovableClock clock = new MovableClock();
        TinyLimiter limiter = new TinyLimiter(clock);

        limiter.tryAcquire("a");
        limiter.tryAcquire("a");
        assertThat(limiter.tryAcquire("a")).isFalse();

        clock.advance(Duration.ofMillis(1000));
        assertThat(limiter.tryAcquire("a")).as("a fresh window starts").isTrue();
    }

    @Test
    void aFloodOfNewKeysDoesNotResetAnExistingCallersCounter() {
        // THE BUG THIS REPLACES: the limiter used to call windows.clear() once the map passed its
        // key budget, so anyone able to mint distinct keys could wipe every real caller's counter
        // and reset all limits — an amplification of the attack it was meant to bound.
        MovableClock clock = new MovableClock();
        TinyLimiter limiter = new TinyLimiter(clock);

        // "victim" spends its whole budget and is now blocked.
        assertThat(limiter.tryAcquire("victim")).isTrue();
        assertThat(limiter.tryAcquire("victim")).isTrue();
        assertThat(limiter.tryAcquire("victim")).isFalse();

        // An attacker floods the map with fresh keys, well past maxKeys (3).
        for (int i = 0; i < 50; i++) {
            limiter.tryAcquire("flood-" + i);
        }

        // The victim is STILL blocked — their live window survived the flood.
        assertThat(limiter.tryAcquire("victim"))
                .as("a key flood must not hand the blocked caller a fresh budget")
                .isFalse();
    }

    @Test
    void expiredWindowsAreReclaimedSoTheMapDoesNotGrowForever() {
        MovableClock clock = new MovableClock();
        TinyLimiter limiter = new TinyLimiter(clock);

        for (int i = 0; i < 10; i++) {
            limiter.tryAcquire("old-" + i);
        }
        // Once those windows expire they are free to drop, so a newcomer is admitted normally.
        clock.advance(Duration.ofMillis(1000));
        assertThat(limiter.tryAcquire("newcomer")).isTrue();
    }
}
