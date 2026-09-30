package com.ankiquiz.repository;

import com.ankiquiz.entity.DeckReport;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

    /*
     * The three listing queries below take a Pageable purely as a BOUND, never for paging.
     *
     * They used to return every matching row. The retention sweep only stamps purge_after on
     * CLOSED reports, so an OPEN queue grows without limit — a spam wave would load the lot into
     * a 512 MB instance to render one admin page. `AdminListLimit.NEWEST` caps it.
     *
     * ⚠ The caller filters by REASON in memory, after this returns, so a reason filter searches
     * within the newest N rather than the whole table. The bound is deliberately far above any
     * queue an admin could actually work through; if the queue ever legitimately exceeds it, this
     * wants real pagination (and the reason filter pushed into SQL), not a bigger number.
     */
public interface DeckReportRepository extends JpaRepository<DeckReport, UUID> {

    /** Enforces "one report per (deck, reporter)" — a re-report is a no-op. */
    Optional<DeckReport> findByDeckIdAndReporterId(UUID deckId, String reporterId);

    List<DeckReport> findByStatusOrderByCreatedAtDesc(String status, Pageable pageable);

    List<DeckReport> findAllByOrderByCreatedAtDesc(Pageable pageable);

    /** Everything that is NOT open — resolved and dismissed together, for the "Closed" filter. */
    List<DeckReport> findByStatusNotOrderByCreatedAtDesc(String status, Pageable pageable);

    /** For the admin badge: how much is still waiting. */
    long countByStatus(String status);

    /** Retention sweep. Only closed reports carry a date, so an open one can never be caught. */
    int deleteByPurgeAfterBefore(OffsetDateTime cutoff);
}
