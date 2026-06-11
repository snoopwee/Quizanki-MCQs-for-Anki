package com.ankiquiz.service;

import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Lightweight in-memory per-IP rate limiter for the public TTS endpoint — a
 * fixed window of {@value #MAX_PER_WINDOW} requests per minute. This is a
 * cost/abuse backstop for the unauthenticated endpoint; the real synthesis-cost
 * control is the Storage cache (each unique string is synthesized once). A
 * production-grade distributed limiter (Bucket4j + Redis / Cloudflare) is the
 * later hardening item. Single-instance only — state isn't shared across nodes.
 */
@Component
public class TtsRateLimiter {

    private static final int MAX_PER_WINDOW = 60;
    private static final long WINDOW_MS = 60_000L;
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
