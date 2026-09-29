package com.ankiquiz.service;

import org.springframework.stereotype.Component;

import java.time.Clock;

/**
 * Rate limit for the public TTS endpoint — {@value #MAX_PER_WINDOW} requests per minute per caller.
 *
 * <p>A cost/abuse backstop only; the real synthesis-cost control is the Storage cache, which
 * synthesizes each unique string once. Looser than {@link ApkgParseRateLimiter} because a single
 * study session legitimately fires many short requests.
 *
 * <p><b>A caller is a signed-in user where possible, and only an IP otherwise</b> — see
 * {@link RateLimitKey}.
 *
 * <p>Single-instance only; the mechanism and its limits are in {@link FixedWindowRateLimiter}.
 */
@Component
public class TtsRateLimiter extends FixedWindowRateLimiter {

    private static final int MAX_PER_WINDOW = 60;
    private static final long WINDOW_MS = 60_000L;
    private static final int MAX_KEYS = 10_000;

    public TtsRateLimiter() {
        this(Clock.systemUTC());
    }

    /** Test seam: a fixed clock makes window expiry assertable without sleeping. */
    public TtsRateLimiter(Clock clock) {
        super(MAX_PER_WINDOW, WINDOW_MS, MAX_KEYS, clock);
    }
}
