package com.ankiquiz.dto.request;

import java.util.List;

/**
 * The client's "which of these do you already have?" pre-check: a batch of
 * content hashes (SHA-256 hex) it is about to upload. The backend answers with the
 * ones already stored so the client skips re-sending them.
 */
public record MediaExistsRequest(List<String> hashes) {
}
