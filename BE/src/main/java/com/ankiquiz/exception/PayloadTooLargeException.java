package com.ankiquiz.exception;

/**
 * A request body bigger than this app is willing to read.
 *
 * <p>Separate from {@code MaxUploadSizeExceededException}, which Spring raises for multipart
 * uploads only. Nothing bounded a plain {@code application/json} body before
 * {@code RequestSizeLimitFilter}: Tomcat's {@code maxPostSize} applies to form encoding, not JSON,
 * so a JSON array of notes was read and materialised in full before any count check could run.
 */
public class PayloadTooLargeException extends RuntimeException {

    public PayloadTooLargeException(String message) {
        super(message);
    }
}
