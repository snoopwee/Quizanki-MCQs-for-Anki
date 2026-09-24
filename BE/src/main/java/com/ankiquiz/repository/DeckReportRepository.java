package com.ankiquiz.repository;

import com.ankiquiz.entity.DeckReport;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DeckReportRepository extends JpaRepository<DeckReport, UUID> {

    /** Enforces "one report per (deck, reporter)" — a re-report is a no-op. */
    Optional<DeckReport> findByDeckIdAndReporterId(UUID deckId, String reporterId);

    List<DeckReport> findByStatusOrderByCreatedAtDesc(String status);

    List<DeckReport> findAllByOrderByCreatedAtDesc();

    /** Everything that is NOT open — resolved and dismissed together, for the "Closed" filter. */
    List<DeckReport> findByStatusNotOrderByCreatedAtDesc(String status);

    /** For the admin badge: how much is still waiting. */
    long countByStatus(String status);

    /** Retention sweep. Only closed reports carry a date, so an open one can never be caught. */
    int deleteByPurgeAfterBefore(OffsetDateTime cutoff);
}
