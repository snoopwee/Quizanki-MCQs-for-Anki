package com.ankiquiz.service;

import com.ankiquiz.dto.request.ImportDeckRequest;
import com.ankiquiz.dto.request.NoteRequest;
import com.ankiquiz.dto.response.DeckResponse;
import com.ankiquiz.entity.Deck;
import com.ankiquiz.entity.Note;
import com.ankiquiz.exception.NotFoundException;
import com.ankiquiz.repository.DeckRepository;
import com.ankiquiz.repository.NoteRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class DeckService {

    private final DeckRepository deckRepository;
    private final NoteRepository noteRepository;

    public DeckService(DeckRepository deckRepository, NoteRepository noteRepository) {
        this.deckRepository = deckRepository;
        this.noteRepository = noteRepository;
    }

    @Transactional(readOnly = true)
    public List<DeckResponse> getDecksForUser(String userId) {
        return deckRepository.findAllByUserIdOrderByImportedAtDesc(userId).stream()
                .map(DeckResponse::from)
                .toList();
    }

    @Transactional
    public void deleteDeck(String userId, UUID deckId) {
        Deck deck = deckRepository.findByIdAndUserId(deckId, userId)
                .orElseThrow(() -> new NotFoundException("Deck not found: " + deckId));
        deckRepository.delete(deck);
    }

    @Transactional
    public DeckResponse importDeck(String userId, ImportDeckRequest request) {
        Deck deck = new Deck();
        deck.setUserId(userId);
        deck.setName(request.name());
        deck.setSubdeckPath(request.subdeckPath());
        deck.setQuestionField(request.questionField());
        deck.setAnswerField(request.answerField());
        deck.setDetectionConfidence(request.detectionConfidence());
        deck.setCardCount(request.notes().size());
        deck.setImportedAt(OffsetDateTime.now());
        Deck savedDeck = deckRepository.save(deck);

        List<Note> notes = buildNotes(savedDeck.getId(), request.notes());
        noteRepository.saveAll(notes);

        return DeckResponse.from(savedDeck);
    }

    private List<Note> buildNotes(UUID deckId, List<NoteRequest> incoming) {
        List<String> ankiIds = incoming.stream()
                .map(NoteRequest::ankiNoteId)
                .filter(id -> id != null && !id.isBlank())
                .toList();

        Map<String, Note> existingByAnkiId = ankiIds.isEmpty()
                ? Map.of()
                : indexByAnkiId(noteRepository.findAllByDeckIdAndAnkiNoteIdIn(deckId, ankiIds));

        List<Note> result = new ArrayList<>(incoming.size());
        for (NoteRequest req : incoming) {
            Note note = (req.ankiNoteId() != null && existingByAnkiId.containsKey(req.ankiNoteId()))
                    ? existingByAnkiId.get(req.ankiNoteId())
                    : new Note();
            note.setDeckId(deckId);
            note.setAnkiNoteId(req.ankiNoteId());
            note.setFields(req.fields());
            note.setTags(req.tags() == null ? new String[0] : req.tags().toArray(String[]::new));
            result.add(note);
        }
        return result;
    }

    private static Map<String, Note> indexByAnkiId(List<Note> notes) {
        Map<String, Note> map = new HashMap<>(notes.size());
        for (Note n : notes) {
            map.put(n.getAnkiNoteId(), n);
        }
        return map;
    }
}
