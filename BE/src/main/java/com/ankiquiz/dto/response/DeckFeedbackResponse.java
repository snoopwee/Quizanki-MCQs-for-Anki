package com.ankiquiz.dto.response;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * The feedback page: every note left on one deck, for its author's eyes only.
 *
 * <p><b>No names.</b> A note carries its stars, its text and when it was written, and nothing that
 * identifies who wrote it — candid feedback needs cover, and user ids are already public
 * identifiers elsewhere in this app, so pairing one with "gave you two stars" would be a real
 * disclosure. There is one rating per person per deck, so each note is a different voice by
 * construction; the author loses nothing by not having a name.
 *
 * <p>{@code id} is the rating's opaque handle (V29), the only thing the client needs to delete a
 * note or, later, report it.
 */
public record DeckFeedbackResponse(
        int count,
        double average,
        List<Note> notes
) {
    public record Note(
            UUID id,
            int stars,
            String note,
            OffsetDateTime writtenAt
    ) {
    }
}
