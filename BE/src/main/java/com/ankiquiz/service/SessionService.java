package com.ankiquiz.service;

import com.ankiquiz.dto.request.RecordAnswerRequest;
import com.ankiquiz.dto.request.StartSessionRequest;
import com.ankiquiz.dto.response.RecordAnswerResponse;
import com.ankiquiz.dto.response.StartSessionResponse;
import com.ankiquiz.entity.CardStats;
import com.ankiquiz.entity.Note;
import com.ankiquiz.exception.NotFoundException;
import com.ankiquiz.repository.CardStatsRepository;
import com.ankiquiz.repository.DeckRepository;
import com.ankiquiz.repository.NoteRepository;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class SessionService {

    private final DeckRepository deckRepository;
    private final NoteRepository noteRepository;
    private final CardStatsRepository cardStatsRepository;
    private final EntityManager entityManager;

    public SessionService(DeckRepository deckRepository,
                          NoteRepository noteRepository,
                          CardStatsRepository cardStatsRepository,
                          EntityManager entityManager) {
        this.deckRepository = deckRepository;
        this.noteRepository = noteRepository;
        this.cardStatsRepository = cardStatsRepository;
        this.entityManager = entityManager;
    }

    @Transactional(readOnly = true)
    public StartSessionResponse startSession(String userId, StartSessionRequest request) {
        deckRepository.findByIdAndUserId(request.deckId(), userId)
                .orElseThrow(() -> new NotFoundException("Deck not found: " + request.deckId()));
        return new StartSessionResponse(UUID.randomUUID());
    }

    @Transactional
    public RecordAnswerResponse recordAnswer(String userId, RecordAnswerRequest request) {
        Note note = noteRepository.findById(request.noteId())
                .orElseThrow(() -> new NotFoundException("Note not found: " + request.noteId()));
        deckRepository.findByIdAndUserId(note.getDeckId(), userId)
                .orElseThrow(() -> new NotFoundException("Note not found: " + request.noteId()));

        entityManager.createNativeQuery("SELECT record_answer(:noteId, :correct)")
                .setParameter("noteId", request.noteId())
                .setParameter("correct", request.correct())
                .getSingleResult();
        entityManager.clear();

        CardStats stats = cardStatsRepository.findById(request.noteId())
                .orElseThrow(() -> new NotFoundException("Card stats not found after recording answer"));
        return new RecordAnswerResponse(stats.getAccuracy(), stats.getStreak());
    }
}
