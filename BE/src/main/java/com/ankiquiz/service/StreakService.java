package com.ankiquiz.service;

import com.ankiquiz.dto.response.StreakResponse;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

/**
 * Daily study streak (Phase 7 S2). Writes one {@code study_days} row per user per local
 * calendar day (V22) and computes the streak from those dates in the caller's timezone.
 *
 * <p>Native SQL with no JPA entity — the same approach as answer_events — so
 * {@code ddl-auto: validate} never needs to know about the table.
 */
@Service
public class StreakService {

    private final EntityManager entityManager;
    private final Clock clock;

    public StreakService(EntityManager entityManager, Clock clock) {
        this.entityManager = entityManager;
        this.clock = clock;
    }

    /** Today's date in the given zone — the day a study action happening now is filed under. */
    public LocalDate todayIn(ZoneId zone) {
        return LocalDate.now(clock.withZone(zone));
    }

    /**
     * Marks today, in the caller's zone, as a study day. Idempotent: the first study action
     * of the day inserts the row and keeps its source; every later one is a no-op.
     */
    @Transactional
    public void markStudied(String userId, ZoneId zone, String source) {
        entityManager.createNativeQuery("""
                INSERT INTO study_days (user_id, local_date, first_source)
                VALUES (:userId, :localDate, :source)
                ON CONFLICT (user_id, local_date) DO NOTHING
                """)
                .setParameter("userId", userId)
                .setParameter("localDate", todayIn(zone))
                .setParameter("source", source)
                .executeUpdate();
    }

    @Transactional(readOnly = true)
    public StreakResponse getStreak(String userId, ZoneId zone) {
        List<?> rows = entityManager.createNativeQuery(
                        "SELECT local_date FROM study_days WHERE user_id = :userId")
                .setParameter("userId", userId)
                .getResultList();
        List<LocalDate> dates = rows.stream().map(StreakService::toLocalDate).toList();
        return StreakCalculator.compute(dates, todayIn(zone));
    }

    // Hibernate returns a native DATE column as java.sql.Date by default; accept LocalDate as
    // well, so a driver or dialect change can't silently break the mapping.
    static LocalDate toLocalDate(Object value) {
        if (value instanceof LocalDate localDate) {
            return localDate;
        }
        if (value instanceof java.sql.Date sqlDate) {
            return sqlDate.toLocalDate();
        }
        throw new IllegalStateException("Unexpected study_days.local_date type: "
                + (value == null ? "null" : value.getClass().getName()));
    }
}
