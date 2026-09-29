package com.ankiquiz.service;

import java.time.Clock;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Fixed-window rate limiting, shared by {@link ApkgParseRateLimiter} and {@link TtsRateLimiter}.
 *
 * <p>The two used to be byte-identical apart from their constants, which is how the same eviction
 * bug came to exist in both. The mechanism lives here now; the subclasses only pick a budget.
 *
 * <p><b>Single-instance only.</b> State is per-process, so N instances allow N times the limit.
 * That is acceptable while one instance runs; moving to several means moving this to Postgres or
 * doing it at the edge. See the note in {@code ApkgParseRateLimiter}.
 */
public abstract class FixedWindowRateLimiter {

    private final int maxPerWindow;
    private final long windowMs;
    private final int maxKeys;
    private final Clock clock;

    /** value = [windowStartMillis, countInWindow] */
    private final Map<String, long[]> windows = new ConcurrentHashMap<>();

    protected FixedWindowRateLimiter(int maxPerWindow, long windowMs, int maxKeys, Clock clock) {
        this.maxPerWindow = maxPerWindow;
        this.windowMs = windowMs;
        this.maxKeys = maxKeys;
        this.clock = clock;
    }

    /** @return true if this request is within budget for {@code key}. */
    public boolean tryAcquire(String key) {
        long now = clock.millis();

        if (windows.size() > maxKeys && !makeRoom(now) && !windows.containsKey(key)) {
            // The map is full of LIVE windows, so a flood is in progress. Refuse keys we are not
            // already tracking rather than admitting them — see makeRoom() for why not clear().
            return false;
        }

        long[] window = windows.compute(key, (k, current) -> {
            if (current == null || now - current[0] >= windowMs) {
                return new long[]{now, 1};
            }
            current[1]++;
            return current;
        });
        return window[1] <= maxPerWindow;
    }

    /**
     * Drops windows that have already expired.
     *
     * <p>This replaces a {@code windows.clear()} that ran once the map passed {@code maxKeys}.
     * That was an amplification of the attack it was meant to bound: anyone could mint 10,000
     * distinct keys — trivial while the key was a spoofable {@code X-Forwarded-For} value — and
     * every real caller's counter was wiped, resetting all limits to zero. Expired entries are
     * free to drop; live ones are exactly the counters that must survive.
     *
     * @return true if anything was freed
     */
    private boolean makeRoom(long now) {
        return windows.entrySet().removeIf(e -> now - e.getValue()[0] >= windowMs);
    }
}
