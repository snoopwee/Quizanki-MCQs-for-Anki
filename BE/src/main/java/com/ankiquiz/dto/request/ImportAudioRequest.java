package com.ankiquiz.dto.request;

import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * The per-note audio references the client collected at parse time, sent (with the
 * original .apkg) to {@code POST /decks/{id}/import-audio} after a deck is saved.
 * Each entry names the {@code [sound:...]} media filename on a note's front / back
 * face; the backend streams just those clips out of the archive and stores them.
 *
 * <p>Keyed by {@code ankiNoteId} so it survives the review edits (reorder / rename /
 * delete) between parse and save — the backend matches these against the deck's
 * persisted notes by their Anki id.
 */
public record ImportAudioRequest(
        @Size(max = 20_000) List<Ref> notes
) {
    public record Ref(
            String ankiNoteId,
            @Size(max = 500) String front,
            @Size(max = 500) String back
    ) {
    }
}
