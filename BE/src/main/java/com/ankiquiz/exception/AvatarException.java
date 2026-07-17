package com.ankiquiz.exception;

import org.springframework.http.HttpStatus;

/**
 * Raised by the avatar upload/delete flow. Carries the HTTP status to return so a
 * validation problem (400/413), a server-side misconfiguration (503), or an
 * upstream Storage failure (502) each surface with the right code.
 */
public class AvatarException extends RuntimeException {

    private final HttpStatus status;

    public AvatarException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public HttpStatus getStatus() {
        return status;
    }
}
