package com.ankiquiz.dto.response;

/**
 * A playable audio URL for the requested text. Either a public Supabase Storage
 * URL (when the clip was cached / freshly uploaded) or an inline
 * {@code data:audio/mpeg;base64,…} URL (when Storage caching is not configured).
 * The FE plays it with {@code new Audio(url)} either way.
 */
public record TtsResponse(String url) {
}
