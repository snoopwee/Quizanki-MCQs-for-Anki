package com.ankiquiz.exception;

/**
 * The request is well-formed and the caller is allowed to make it, but the
 * resource is in a state that refuses it — e.g. sharing a copy that hasn't been
 * made the caller's own yet. Maps to 409.
 */
public class ConflictException extends RuntimeException {
    public ConflictException(String message) {
        super(message);
    }
}
