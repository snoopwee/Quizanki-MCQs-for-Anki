package com.ankiquiz.dto.request;

import jakarta.validation.constraints.NotBlank;

/**
 * A requested public handle. The shape rules live in {@code Usernames} rather than in annotations
 * here, because the same rules have to be applied to a GENERATED handle too, where there is no
 * request to validate.
 */
public record UsernameRequest(
        @NotBlank(message = "Pick a username.")
        String username
) {
}
