package com.ankiquiz.dto.request;

import jakarta.validation.constraints.NotNull;

/**
 * Body of {@code PATCH /decks/{id}/share} — turns the deck's public share link on
 * or off. Boxed so a missing field fails validation instead of silently
 * defaulting to "unshare".
 */
public record ShareDeckRequest(@NotNull Boolean isPublic) {
}
