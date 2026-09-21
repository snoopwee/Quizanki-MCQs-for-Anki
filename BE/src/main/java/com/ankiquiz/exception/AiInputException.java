package com.ankiquiz.exception;

/**
 * Thrown when the material handed to AI generation can't be used — empty, too short to make cards
 * from, or not text at all. Surfaced as HTTP 400: the user can fix it by pasting something else,
 * unlike {@link AiUnavailableException}, which is our problem or the provider's.
 */
public class AiInputException extends RuntimeException {
    public AiInputException(String message) {
        super(message);
    }
}
