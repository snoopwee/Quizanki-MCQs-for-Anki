package com.ankiquiz.service;

import com.ankiquiz.dto.request.RecordAnswerRequest;
import com.ankiquiz.dto.request.StartSessionRequest;
import com.ankiquiz.dto.response.RecordAnswerResponse;
import com.ankiquiz.entity.CardStats;
import com.ankiquiz.entity.Deck;
import com.ankiquiz.entity.Note;
import com.ankiquiz.exception.NotFoundException;
import com.ankiquiz.repository.CardStatsRepository;
import com.ankiquiz.repository.DeckRepository;
import com.ankiquiz.repository.NoteRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SessionServiceTest {

    private static final String USER = "user-1";

    @Mock private DeckRepository deckRepository;
    @Mock private NoteRepository noteRepository;
    @Mock private CardStatsRepository cardStatsRepository;
    @Mock private EntityManager entityManager;
    @Mock private Query query;

    private SessionService service;

    private final UUID deckId = UUID.randomUUID();
    private final UUID noteId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new SessionService(deckRepository, noteRepository, cardStatsRepository, entityManager);
    }

    private Note note() {
        Note n = new Note();
        n.setId(noteId);
        n.setDeckId(deckId);
        return n;
    }

    // ── access gate (studiable = owned or public) ────────────────────────────

    @Test
    void startSession_throwsNotFound_whenDeckNotStudiable() {
        when(deckRepository.findStudiable(deckId, USER)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.startSession(USER, new StartSessionRequest(deckId, 10, null)))
                .isInstanceOf(NotFoundException.class);
    }

    @Test
    void recordAnswer_throwsNotFound_andRecordsNothing_whenDeckNotStudiable() {
        when(noteRepository.findById(noteId)).thenReturn(Optional.of(note()));
        // The note exists, but its deck is private and not the caller's.
        when(deckRepository.findStudiable(deckId, USER)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.recordAnswer(USER, UUID.randomUUID(),
                new RecordAnswerRequest(noteId, true)))
                .isInstanceOf(NotFoundException.class);

        // Crucially, no progress was written for a deck the caller may not study.
        verify(entityManager, never()).createNativeQuery(anyString());
    }

    // ── happy path: records the CALLER's own progress ────────────────────────

    @Test
    void recordAnswer_recordsForACallerStudyingAPublicDeck() {
        UUID sessionId = UUID.randomUUID();
        when(noteRepository.findById(noteId)).thenReturn(Optional.of(note()));
        // A public deck owned by someone else is studiable.
        when(deckRepository.findStudiable(deckId, USER)).thenReturn(Optional.of(new Deck()));

        // record_answer(...) is a DB function; stub the native call chain.
        when(entityManager.createNativeQuery(anyString())).thenReturn(query);
        when(query.setParameter(anyString(), any())).thenReturn(query);
        when(query.getSingleResult()).thenReturn(0);

        CardStats stats = new CardStats();
        stats.setUserId(USER);
        stats.setNoteId(noteId);
        stats.setAccuracy(1.0);
        stats.setStreak(1);
        stats.setMastery(15.0);
        when(cardStatsRepository.findByUserIdAndNoteId(USER, noteId)).thenReturn(Optional.of(stats));

        RecordAnswerResponse res = service.recordAnswer(USER, sessionId,
                new RecordAnswerRequest(noteId, true));

        assertThat(res.mastery()).isEqualTo(15.0);
        assertThat(res.streak()).isEqualTo(1);
        // The acting user is threaded into record_answer, not the deck owner.
        verify(query).setParameter(eq("userId"), eq(USER));
    }
}
