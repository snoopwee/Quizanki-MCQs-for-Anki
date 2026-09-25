package com.ankiquiz.dto.response;

/**
 * Whether this account has its own provider key stored, and which one it looks like.
 *
 * Never carries the key. {@code hint} is the last four characters, enough for the owner to
 * recognise it; {@code supported} is false when the server has no encryption key configured, in
 * which case bring-your-own-key is switched off for everyone.
 */
public record AiKeyStatusResponse(
        boolean supported,
        boolean configured,
        String provider,
        String hint
) {
}
