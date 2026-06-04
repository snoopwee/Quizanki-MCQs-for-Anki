package com.ankiquiz.dto.request;

import jakarta.validation.constraints.NotNull;

/**
 * Toggle a flashcard's star (focus) flag. Sent by the FE star button on the
 * flashcard list and mid-quiz. {@code starred=true} stars the card,
 * {@code false} unstars it.
 */
public record SetStarRequest(
        @NotNull Boolean starred
) {
}
