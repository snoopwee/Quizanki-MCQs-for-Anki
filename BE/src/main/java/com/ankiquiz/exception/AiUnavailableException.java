package com.ankiquiz.exception;

/**
 * Thrown when AI generation can't be served: the feature is switched off, no key is available
 * (neither ours nor the user's), or the provider failed. Surfaced as HTTP 503 by
 * {@code GlobalExceptionHandler} — the FE keeps the manual and import paths, which always work.
 */
public class AiUnavailableException extends RuntimeException {
    public AiUnavailableException(String message) {
        super(message);
    }

    public AiUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
