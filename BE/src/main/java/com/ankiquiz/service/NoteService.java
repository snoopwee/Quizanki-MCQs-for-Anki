package com.ankiquiz.service;

import com.ankiquiz.dto.response.CardStatsResponse;
import com.ankiquiz.dto.response.NoteResponse;
import com.ankiquiz.entity.CardStats;
import com.ankiquiz.entity.Note;
import com.ankiquiz.exception.NotFoundException;
import com.ankiquiz.repository.CardStatsRepository;
import com.ankiquiz.repository.DeckRepository;
import com.ankiquiz.repository.NoteRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class NoteService {

    private static final int DEFAULT_LIMIT = 50;
    private static final int MAX_LIMIT = 200;

    private final DeckRepository deckRepository;
    private final NoteRepository noteRepository;
    private final CardStatsRepository cardStatsRepository;

    public NoteService(DeckRepository deckRepository,
                       NoteRepository noteRepository,
                       CardStatsRepository cardStatsRepository) {
        this.deckRepository = deckRepository;
        this.noteRepository = noteRepository;
        this.cardStatsRepository = cardStatsRepository;
    }

    @Transactional(readOnly = true)
    public List<NoteResponse> getNotes(String userId, UUID deckId, List<String> tags,
                                       boolean weakOnly, Integer limit) {
        deckRepository.findByIdAndUserId(deckId, userId)
                .orElseThrow(() -> new NotFoundException("Deck not found: " + deckId));

        String tagsCsv = (tags == null || tags.isEmpty()) ? "" : String.join(",", tags);
        int effectiveLimit = clampLimit(limit);

        List<Note> notes = noteRepository.findFiltered(deckId, tagsCsv, weakOnly, effectiveLimit);
        if (notes.isEmpty()) {
            return List.of();
        }

        Map<UUID, CardStats> statsByNoteId = cardStatsRepository
                .findAllById(notes.stream().map(Note::getId).toList()).stream()
                .collect(Collectors.toMap(CardStats::getNoteId, Function.identity()));

        return notes.stream()
                .map(note -> {
                    CardStats stats = statsByNoteId.get(note.getId());
                    return NoteResponse.from(note, stats == null ? null : CardStatsResponse.from(stats));
                })
                .toList();
    }

    private static int clampLimit(Integer limit) {
        if (limit == null) {
            return DEFAULT_LIMIT;
        }
        return Math.max(1, Math.min(limit, MAX_LIMIT));
    }
}
