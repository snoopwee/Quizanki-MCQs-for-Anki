package com.ankiquiz.dto.request;

import jakarta.validation.constraints.Size;

/**
 * Body of {@code PUT /me/author-profile}: the display name + avatar URL the user
 * currently has, sent so the backend can stamp them onto the decks they author
 * without waiting for the JWT to refresh. Both nullable — a blank name falls back
 * to the JWT-resolved default; a blank avatar means "no photo".
 */
public record AuthorProfileRequest(@Size(max = 60) String name, @Size(max = 2000) String avatarUrl) {
}
