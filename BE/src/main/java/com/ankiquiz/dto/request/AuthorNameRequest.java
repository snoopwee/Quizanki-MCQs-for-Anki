package com.ankiquiz.dto.request;

import jakarta.validation.constraints.Size;

/**
 * Body of {@code PUT /me/author-name}: the display name the user just set, sent so
 * the backend can stamp it onto their authored decks without waiting for the JWT
 * to refresh. Blank / null means "cleared" — the backend falls back to the
 * JWT-resolved default.
 */
public record AuthorNameRequest(@Size(max = 60) String name) {
}
