package com.ankiquiz.exception;

/**
 * Thrown when cloud text-to-speech can't be served — the provider API key isn't
 * configured (feature dormant) or the provider call failed. Surfaced as HTTP 503
 * by {@code GlobalExceptionHandler}; the FE treats it as "no cloud voice" and
 * falls back to the device's own voices.
 */
public class TtsUnavailableException extends RuntimeException {
    public TtsUnavailableException(String message) {
        super(message);
    }

    public TtsUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
