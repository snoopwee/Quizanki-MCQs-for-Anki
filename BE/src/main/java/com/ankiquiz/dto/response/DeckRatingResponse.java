package com.ankiquiz.dto.response;

/**
 * The rating state of one deck for one caller: the public score, plus that caller's own rating so
 * the stars render filled in.
 *
 * {@code myNote} is the caller's OWN note echoed back to them — it is never anyone else's. Nobody
 * but the deck's author sees another person's note, and that happens through its own endpoint.
 *
 * @param average 0 when nobody has rated yet; the client decides how to show "not rated".
 */
public record DeckRatingResponse(
        int count,
        double average,
        Integer myStars,
        String myNote,
        // How many notes are waiting on the feedback page. Only ever non-zero for the deck's
        // author — nobody else may read them, so nobody else is told how many there are.
        int notesForAuthor
) {
}
