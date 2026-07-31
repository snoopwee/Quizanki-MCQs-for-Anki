package com.ankiquiz.dto.response;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * One row of the admin reports queue: the report plus the reported deck's name and
 * credited author (joined in the service). {@code deckName}/{@code authorName} may
 * be null if the deck was deleted after the report (the cascade removes the report
 * too, so this is rare).
 */
public record AdminReportResponse(
        UUID id,
        UUID deckId,
        String deckName,
        String authorName,
        String reporterId,
        String reason,
        String details,
        String status,
        OffsetDateTime createdAt
) {
}
