package com.ankiquiz.dto.response;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * One row of the notification panel. {@code title} / {@code body} are the snapshot the backend
 * wrote, but {@code kind}, {@code actorName} and {@code deckId} come along too so the client can
 * word a row its own way instead of being stuck with ours.
 *
 * {@code link} is an in-app route ("/decks/&lt;id&gt;"), never an absolute URL, and may be null.
 */
public record NotificationResponse(
        UUID id,
        String kind,
        String title,
        String body,
        String link,
        String actorId,
        String actorName,
        UUID deckId,
        boolean read,
        OffsetDateTime createdAt
) {
}
