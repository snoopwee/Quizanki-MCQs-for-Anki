package com.ankiquiz.dto.response;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * One row of the admin queue for reported notes: the report, the text that was reported (a snapshot
 * taken when it was reported, so it survives the note being cleared), and the deck it was left on.
 *
 * <p>{@code writerId} / {@code writerName} are ADMIN-ONLY and exist so a repeat offender can
 * actually be reached: without them, judging a note abusive was a dead end, because an admin
 * takedown deletes the rating and with it every route back to the account. The author's feedback
 * page still shows no names at all.
 */
public record AdminReviewReportResponse(
        UUID id,
        UUID deckId,
        String deckName,
        String reporterId,
        String reason,
        String details,
        String noteSnapshot,
        // Who wrote it, as recorded when it was reported. `writerName` may be null; the id is what
        // identifies the account, and is what the Users screen takes.
        String writerId,
        String writerName,
        // Whether the rating is still there to act on. The note may already have been cleared by
        // the author while the star stands — that rating can still be taken down.
        boolean ratingStillThere,
        String status,
        // Why an admin acted (V38). Null while the report is still open, and on rows that
        // predate the requirement.
        String resolutionNote,
        OffsetDateTime createdAt
) {
}
