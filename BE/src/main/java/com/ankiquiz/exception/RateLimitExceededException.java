package com.ankiquiz.exception;

/**
 * Thrown when a client exceeds the per-IP request budget for a public endpoint.
 * Surfaced as HTTP 429 by {@code GlobalExceptionHandler}.
 */
public class RateLimitExceededException extends RuntimeException {
    public RateLimitExceededException(String message) {
        super(message);
    }
}
