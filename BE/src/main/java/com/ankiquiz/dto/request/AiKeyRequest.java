package com.ankiquiz.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Body of {@code PUT /me/ai-key} — a user's own provider key.
 *
 * The key is encrypted before it is stored and is never returned, logged, or echoed in an error.
 */
public record AiKeyRequest(
        @NotBlank @Size(max = 64) String provider,
        @NotBlank @Size(max = 512) String apiKey
) {
}
