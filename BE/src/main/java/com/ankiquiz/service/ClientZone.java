package com.ankiquiz.service;

import java.time.DateTimeException;
import java.time.ZoneId;
import java.time.ZoneOffset;

/**
 * Parses the timezone a client reports — an IANA id such as {@code Asia/Ho_Chi_Minh}.
 *
 * <p>Deliberately lenient: a missing, unknown, or oversized value falls back to UTC
 * instead of failing, because the timezone only decides which calendar day a study
 * action is filed under. It must never block recording an answer.
 *
 * <p>The value is client-supplied, so a user could shift their day boundary by claiming
 * another zone. For a personal streak with no rewards attached, that's an accepted
 * trade-off.
 */
public final class ClientZone {

    static final int MAX_LENGTH = 64;

    private ClientZone() {
    }

    public static ZoneId parse(String raw) {
        if (raw == null || raw.isBlank() || raw.length() > MAX_LENGTH) {
            return ZoneOffset.UTC;
        }
        try {
            return ZoneId.of(raw.trim());
        } catch (DateTimeException e) {
            return ZoneOffset.UTC;
        }
    }
}
