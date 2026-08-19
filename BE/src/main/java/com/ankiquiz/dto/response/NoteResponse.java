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
        // Per-face card image URLs (null = no image), so an in-player edit reflects
        // the change without a refetch.
        String frontImageUrl,
        String backImageUrl,
        // Per-face audio clip URLs (null = no audio), same rationale as the images.
        String frontAudioUrl,
        String backAudioUrl,
        CardStatsResponse cardStats
) {
    public static NoteResponse from(Note note, CardStatsResponse cardStats) {
        return new NoteResponse(
                note.getId(),
                note.getDeckId(),
                note.getFields(),
                note.getTags() == null ? List.of() : List.of(note.getTags()),
                note.getFrontImageUrl(),
                note.getBackImageUrl(),
                note.getFrontAudioUrl(),
                note.getBackAudioUrl(),
                cardStats
        );
    }
}
