package com.ankiquiz.exception;

/**
 * Thrown when an uploaded file cannot be read as a valid Anki {@code .apkg}
 * archive. Surfaced to the client as HTTP 400 by {@code GlobalExceptionHandler}.
 */
public class ApkgParseException extends RuntimeException {
    public ApkgParseException(String message) {
        super(message);
    }

    public ApkgParseException(String message, Throwable cause) {
        super(message, cause);
    }
}
