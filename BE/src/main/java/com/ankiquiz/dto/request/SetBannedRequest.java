package com.ankiquiz.dto.request;

import jakarta.validation.constraints.Size;

/**
 * Suspend or restore an account.
 *
 * <p>{@code reason} is required when suspending and <b>is shown to the person suspended</b> — it is
 * the whole point of the suspension living in our database rather than at Supabase. It is optional
 * when lifting, where it becomes the note in their "account restored" notification.
 *
 * <p>Not annotated `@NotBlank`: the same body serves both directions, and only one of them requires
 * it. The service enforces it, so the message can explain who reads it.
 */
public record SetBannedRequest(
        boolean banned,
        @Size(max = 1000, message = "Keep the reason under 1000 characters.")
        String reason
) {
}
