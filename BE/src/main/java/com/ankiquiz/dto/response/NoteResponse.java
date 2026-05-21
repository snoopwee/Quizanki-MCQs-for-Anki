package com.ankiquiz.dto.response;

import com.ankiquiz.entity.Note;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public record NoteResponse(
        UUID id,
        UUID deckId,
        Map<String, String> fields,
        List<String> tags,
        CardStatsResponse cardStats
) {
    public static NoteResponse from(Note note, CardStatsResponse cardStats) {
        return new NoteResponse(
                note.getId(),
                note.getDeckId(),
                note.getFields(),
                note.getTags() == null ? List.of() : List.of(note.getTags()),
                cardStats
        );
    }
}
