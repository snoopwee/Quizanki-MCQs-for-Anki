package com.ankiquiz.dto.response;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * One row of the admin queue for reported notes: the report, the text that was reported (a snapshot
 * taken when it was reported, so it survives the note being cleared), and the deck it was left on.
 *
 * <p>No writer identity. The queue judges text; if an admin decides to act on the person, that goes
 * through the user tools, which is the one moment identity is warranted.
 */
public record AdminReviewReportResponse(
        UUID id,
        UUID deckId,
        String deckName,
        String reporterId,
        String reason,
        String details,
        String noteSnapshot,
        // Whether the note itself is still live; false once the author or an admin cleared it.
        boolean noteStillThere,
        String status,
        OffsetDateTime createdAt
) {
}
