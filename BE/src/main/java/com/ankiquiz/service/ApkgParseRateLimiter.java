package com.ankiquiz.service;

import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Lightweight in-memory per-IP rate limiter for the public {@code /parse-apkg}
 * endpoint — a fixed window of {@value #MAX_PER_WINDOW} parses per
 * {@value #WINDOW_MS} ms per IP.
 *
 * <p>Parsing is by far the most expensive public operation (unzip → SQLite →
 * optional zstd, capped at 50 MB and ~20 s), so its budget is deliberately
 * tighter than {@link TtsRateLimiter}'s. This caps the CPU an anonymous flood
 * can burn, which is the key defence for staying inside a free-tier host's
 * compute/request budget (the endpoint already persists nothing). Single-instance
 * only — state isn't shared across nodes; a distributed limiter (Bucket4j + Redis
 * / Cloudflare) is the later hardening item. Mirrors {@link TtsRateLimiter}.
 */
@Component
public class ApkgParseRateLimiter {

    private static final int MAX_PER_WINDOW = 10;
    private static final long WINDOW_MS = 600_000L; // 10 minutes
    // Crude memory bound: if too many distinct IPs accumulate, drop all windows.
    private static final int MAX_KEYS = 10_000;

    // value = [windowStartMillis, countInWindow]
    private final Map<String, long[]> windows = new ConcurrentHashMap<>();

    public boolean tryAcquire(String key) {
        if (windows.size() > MAX_KEYS) {
            windows.clear();
        }
        long now = System.currentTimeMillis();
        long[] window = windows.compute(key, (k, current) -> {
            if (current == null || now - current[0] >= WINDOW_MS) {
                return new long[]{now, 1};
            }
            current[1]++;
            return current;
        });
        return window[1] <= MAX_PER_WINDOW;
    }
}
