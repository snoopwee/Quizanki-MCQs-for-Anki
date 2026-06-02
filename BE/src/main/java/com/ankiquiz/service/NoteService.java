package com.ankiquiz.service;

import com.ankiquiz.dto.response.CardStatsResponse;
import com.ankiquiz.dto.response.NoteResponse;
import com.ankiquiz.entity.CardStats;
import com.ankiquiz.entity.Note;
import com.ankiquiz.entity.NoteType;
import com.ankiquiz.exception.NotFoundException;
import com.ankiquiz.repository.CardStatsRepository;
import com.ankiquiz.repository.DeckRepository;
import com.ankiquiz.repository.NoteRepository;
import com.ankiquiz.repository.NoteTypeRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class NoteService {

    private static final int DEFAULT_LIMIT = 50;
    private static final int MAX_LIMIT = 200;

    private final DeckRepository deckRepository;
    private final NoteRepository noteRepository;
    private final NoteTypeRepository noteTypeRepository;
    private final CardStatsRepository cardStatsRepository;

    public NoteService(DeckRepository deckRepository,
                       NoteRepository noteRepository,
                       NoteTypeRepository noteTypeRepository,
                       CardStatsRepository cardStatsRepository) {
        this.deckRepository = deckRepository;
        this.noteRepository = noteRepository;
        this.noteTypeRepository = noteTypeRepository;
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

    /**
     * Edit a single flashcard's field values. Scoped by deck ownership, then by
     * note→deck so a user can't touch another deck's note. Only field keys that
     * belong to the note's type are accepted; incoming values are merged over the
     * existing field map, so an empty or partial form can't drop other fields or
     * inject unknown ones. Cloze markup ({{c1::...}}) is stored verbatim.
     */
    @Transactional
    public NoteResponse updateNote(String userId, UUID deckId, UUID noteId, Map<String, String> incoming) {
        deckRepository.findByIdAndUserId(deckId, userId)
                .orElseThrow(() -> new NotFoundException("Deck not found: " + deckId));
        Note note = noteRepository.findByIdAndDeckId(noteId, deckId)
                .orElseThrow(() -> new NotFoundException("Note not found: " + noteId));

        Set<String> allowed = allowedFieldKeys(note);
        Map<String, String> merged = new LinkedHashMap<>(
                note.getFields() == null ? Map.of() : note.getFields());
        for (Map.Entry<String, String> e : incoming.entrySet()) {
            if (allowed.isEmpty() || allowed.contains(e.getKey())) {
                merged.put(e.getKey(), e.getValue() == null ? "" : e.getValue());
            }
        }
        note.setFields(merged);
        Note saved = noteRepository.save(note);

        CardStats stats = cardStatsRepository.findById(saved.getId()).orElse(null);
        return NoteResponse.from(saved, stats == null ? null : CardStatsResponse.from(stats));
    }

    // Keys the edit form may write: the note type's declared field names when we
    // have them, else fall back to whatever keys the note already carries (unknown
    // model). Empty set = no constraint (don't lock out an unusual note).
    private Set<String> allowedFieldKeys(Note note) {
        if (note.getNoteTypeId() != null) {
            NoteType type = noteTypeRepository.findById(note.getNoteTypeId()).orElse(null);
            if (type != null && type.getFieldNames() != null && type.getFieldNames().length > 0) {
                return new LinkedHashSet<>(Arrays.asList(type.getFieldNames()));
            }
        }
        return note.getFields() == null ? Set.of() : note.getFields().keySet();
    }

    private static int clampLimit(Integer limit) {
        if (limit == null) {
            return DEFAULT_LIMIT;
        }
        return Math.max(1, Math.min(limit, MAX_LIMIT));
    }
}
