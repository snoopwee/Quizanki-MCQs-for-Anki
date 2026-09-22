package com.ankiquiz.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Rate a deck.
 *
 * @param stars 1-5, matching V28's check constraint.
 * @param note  optional, and <b>private</b>: only the deck's author ever reads it. The client says
 *              so next to the field — people write differently when they think it is public.
 */
public record DeckRatingRequest(
        @NotNull(message = "Pick a rating")
        @Min(value = 1, message = "A rating is 1 to 5 stars")
        @Max(value = 5, message = "A rating is 1 to 5 stars")
        Integer stars,

        @Size(max = 1000, message = "Keep your note under 1000 characters")
        String note
) {
}
