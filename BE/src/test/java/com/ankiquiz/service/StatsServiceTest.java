package com.ankiquiz.service;

import com.ankiquiz.exception.NotFoundException;
import com.ankiquiz.repository.DeckRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StatsServiceTest {

    private static final String USER = "user-1";

    @Mock private DeckRepository deckRepository;
    @Mock private EntityManager entityManager;

    private StatsService service;

    private final UUID deckId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new StatsService(deckRepository, entityManager);
    }

    // Stats are the viewer's OWN progress, so they gate on studiable (owned or
    // public) — not ownership — and never run their query for an inaccessible deck.

    @Test
    void getDeckStats_throwsNotFound_whenDeckNotStudiable() {
        when(deckRepository.findStudiable(deckId, USER)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getDeckStats(USER, deckId))
                .isInstanceOf(NotFoundException.class);
        verify(entityManager, never()).createNativeQuery(anyString());
    }

    @Test
    void getDeckHistory_throwsNotFound_whenDeckNotStudiable() {
        when(deckRepository.findStudiable(deckId, USER)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getDeckHistory(USER, deckId, 30))
                .isInstanceOf(NotFoundException.class);
        verify(entityManager, never()).createNativeQuery(anyString());
    }
}
