package com.ankiquiz.service;

import org.springframework.stereotype.Component;

import java.time.Clock;

/**
 * Rate limit for the public {@code /parse-apkg} endpoint — {@value #MAX_PER_WINDOW} parses per
 * {@value #WINDOW_MS} ms per caller.
 *
 * <p>Parsing is by far the most expensive public operation (unzip → SQLite → optional zstd, capped
 * at 50 MB and ~20 s), so its budget is deliberately tighter than {@link TtsRateLimiter}'s. This
 * caps the CPU an anonymous flood can burn, which is the key defence for staying inside a free-tier
 * host's compute budget (the endpoint already persists nothing).
 *
 * <p><b>A caller is a signed-in user where possible, and only an IP otherwise</b> — see
 * {@link RateLimitKey}. Keying purely by IP made a room of people on one Wi-Fi share a single
 * budget, which broke the live group tests this app is actually used for.
 *
 * <p>Single-instance only; the mechanism and its limits are in {@link FixedWindowRateLimiter}.
 */
@Component
public class ApkgParseRateLimiter extends FixedWindowRateLimiter {

    private static final int MAX_PER_WINDOW = 10;
    private static final long WINDOW_MS = 600_000L; // 10 minutes
    private static final int MAX_KEYS = 10_000;

    public ApkgParseRateLimiter() {
        this(Clock.systemUTC());
    }

    /** Test seam: a fixed clock makes window expiry assertable without sleeping. */
    public ApkgParseRateLimiter(Clock clock) {
        super(MAX_PER_WINDOW, WINDOW_MS, MAX_KEYS, clock);
    }
}
