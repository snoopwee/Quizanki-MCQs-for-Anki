package com.ankiquiz.dto.request;

import jakarta.validation.constraints.NotNull;

/**
 * Body of {@code PUT /decks/{id}/save} — bookmark a deck to the user's Home
 * ("Save to Home") or remove it. Boxed so a missing field is a 400, not a silent
 * default.
 */
public record SaveDeckRequest(@NotNull Boolean saved) {
}
