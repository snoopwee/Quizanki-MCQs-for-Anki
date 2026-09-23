package com.ankiquiz.dto.request;

import jakarta.validation.constraints.NotNull;

/** Switch one notification kind off ({@code muted: true}) or back on. */
public record MuteRequest(
        @NotNull(message = "Say whether it should be muted")
        Boolean muted
) {
}
