package com.ankiquiz.exception;

/**
 * Thrown when a user's own provider API key is malformed on the way in, or the provider rejects
 * it on the way out. Surfaced as HTTP 400 so the Settings screen can say "that key didn't work"
 * instead of the generic 503 a provider outage produces.
 *
 * The message must never echo the key itself.
 */
public class AiKeyInvalidException extends RuntimeException {
    public AiKeyInvalidException(String message) {
        super(message);
    }
}
