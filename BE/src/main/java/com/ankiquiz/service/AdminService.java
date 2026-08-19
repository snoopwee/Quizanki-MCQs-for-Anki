package com.ankiquiz.service;

import com.ankiquiz.dto.response.AdminStatsResponse;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Admin dashboard data that spans entities (decks + notes + progress + events), so
 * it lives here rather than in any one entity's service. Access is gated to admins
 * by SecurityConfig (/api/v1/admin/**) — no per-user checks here.
 */
@Service
public class AdminService {

    private final EntityManager entityManager;

    public AdminService(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    /**
     * Every overview number in one round trip — the DB is a remote Supabase pooler,
     * so eight scalar sub-selects in a single query beat eight separate calls.
     */
    @Transactional(readOnly = true)
    public AdminStatsResponse getStats() {
        // Each column MUST have a distinct alias: Postgres labels every count(*)
        // "count", and Hibernate auto-discovers native-query columns by alias —
        // duplicate labels throw NonUniqueDiscoveredSqlAliasException.
        Object[] row = (Object[]) entityManager.createNativeQuery("""
                select
                  (select count(*) from decks) as total_decks,
                  (select count(*) from decks where is_public) as public_decks,
                  (select count(*) from notes) as total_notes,
                  (select count(distinct user_id) from decks) as creators,
                  (select count(distinct user_id) from card_stats) as learners,
                  (select count(*) from answer_events) as total_answers,
                  (select count(*) from decks where imported_at > now() - interval '30 days') as decks_30d,
                  (select count(*) from answer_events where answered_at > now() - interval '7 days') as answers_7d
                """).getSingleResult();

        return new AdminStatsResponse(
                num(row[0]), num(row[1]), num(row[2]), num(row[3]),
                num(row[4]), num(row[5]), num(row[6]), num(row[7]));
    }

    // COUNT comes back as Long/BigInteger depending on the driver — normalise.
    private static long num(Object value) {
        return value == null ? 0L : ((Number) value).longValue();
    }
}
