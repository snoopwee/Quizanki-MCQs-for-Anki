package com.ankiquiz.service;

import com.ankiquiz.dto.response.DeckStatsResponse;
import com.ankiquiz.exception.NotFoundException;
import com.ankiquiz.repository.DeckRepository;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class StatsService {

    private final DeckRepository deckRepository;
    private final EntityManager entityManager;

    public StatsService(DeckRepository deckRepository, EntityManager entityManager) {
        this.deckRepository = deckRepository;
        this.entityManager = entityManager;
    }

    @Transactional(readOnly = true)
    public DeckStatsResponse getDeckStats(String userId, UUID deckId) {
        deckRepository.findByIdAndUserId(deckId, userId)
                .orElseThrow(() -> new NotFoundException("Deck not found: " + deckId));

        // Two-step query: first compute the card_stats aggregates over the deck's
        // seen cards, then divide the SUM of mastery by the deck's TOTAL note count
        // (not the seen count) so unseen notes contribute 0 to completion.
        Object[] row = (Object[]) entityManager.createNativeQuery("""
                SELECT
                    (SELECT count(*) FROM notes WHERE deck_id = :deckId)              AS total,
                    count(cs.note_id)                                                 AS seen,
                    coalesce(avg(cs.accuracy), 0)                                     AS avg_acc,
                    count(*) FILTER (WHERE cs.accuracy < 0.7)                         AS weak,
                    count(*) FILTER (WHERE cs.streak >= 5)                            AS mastered,
                    coalesce(sum(cs.mastery), 0)                                      AS sum_mastery
                FROM card_stats cs
                JOIN notes n ON n.id = cs.note_id
                WHERE n.deck_id = :deckId
                """)
                .setParameter("deckId", deckId)
                .getSingleResult();

        long total = ((Number) row[0]).longValue();
        double sumMastery = ((Number) row[5]).doubleValue();
        double averageMastery = total == 0 ? 0.0 : sumMastery / total;

        return new DeckStatsResponse(
                total,
                ((Number) row[1]).longValue(),
                ((Number) row[2]).doubleValue(),
                ((Number) row[3]).longValue(),
                ((Number) row[4]).longValue(),
                averageMastery
        );
    }
}
