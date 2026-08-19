package com.ankiquiz.dto.response;

import java.util.Map;

/**
 * Answer to the media pre-check: hash → public URL for every requested hash that
 * is already stored. Hashes not present are simply absent, meaning "upload it".
 */
public record MediaExistsResponse(Map<String, String> urls) {
}
