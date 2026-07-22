package com.ankiquiz.service;

import com.ankiquiz.dto.response.DeckHistoryPoint;
import com.ankiquiz.dto.response.DeckStatsResponse;
import com.ankiquiz.exception.NotFoundException;
import com.ankiquiz.repository.DeckRepository;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
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

    // Cap the look-back so a hostile ?days param can't scan the whole log.
    private static final int MAX_HISTORY_DAYS = 365;

    /**
     * MCQ accuracy per test for a deck over the last {@code days} days, oldest
     * first. One point per quiz session (answers sharing a session id); legacy
     * events with no session id (pre-V8) collapse per UTC calendar day. Each
     * point's timestamp is when that test's last answer landed.
     */
    @Transactional(readOnly = true)
    public List<DeckHistoryPoint> getDeckHistory(String userId, UUID deckId, int days) {
        deckRepository.findByIdAndUserId(deckId, userId)
                .orElseThrow(() -> new NotFoundException("Deck not found: " + deckId));

        int window = Math.max(1, Math.min(days, MAX_HISTORY_DAYS));
        // Start of the earliest day in the window, in UTC.
        OffsetDateTime since = LocalDate.now(ZoneOffset.UTC)
                .minusDays(window - 1L)
                .atStartOfDay()
                .atOffset(ZoneOffset.UTC);

        // Group each answer by its session (one point per test). Rows written
        // before V8 have session_id NULL, so fall back to a per-day key for those
        // so early history still charts as one point per day. `at` is epoch millis
        // of the test's last answer.
        @SuppressWarnings("unchecked")
        List<Object[]> rows = entityManager.createNativeQuery("""
                SELECT
                    (extract(epoch FROM max(ae.answered_at)) * 1000)::bigint AS at_ms,
                    count(*)                                                  AS answered,
                    count(*) FILTER (WHERE ae.correct)                        AS correct
                FROM answer_events ae
                JOIN notes n ON n.id = ae.note_id
                WHERE n.deck_id = :deckId
                  AND ae.answered_at >= :since
                GROUP BY
                    CASE WHEN ae.session_id IS NOT NULL
                         THEN 'sess:' || ae.session_id::text
                         ELSE 'day:' || to_char(date_trunc('day', ae.answered_at), 'YYYY-MM-DD')
                    END
                ORDER BY at_ms
                """)
                .setParameter("deckId", deckId)
                .setParameter("since", since)
                .getResultList();

        return rows.stream().map(row -> {
            long at = ((Number) row[0]).longValue();
            long answered = ((Number) row[1]).longValue();
            long correct = ((Number) row[2]).longValue();
            double accuracy = answered == 0 ? 0.0 : (double) correct / answered;
            return new DeckHistoryPoint(at, answered, correct, accuracy);
        }).toList();
    }
}
