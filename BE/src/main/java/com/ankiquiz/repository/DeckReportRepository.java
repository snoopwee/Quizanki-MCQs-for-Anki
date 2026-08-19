package com.ankiquiz.repository;

import com.ankiquiz.entity.DeckReport;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DeckReportRepository extends JpaRepository<DeckReport, UUID> {

    /** Enforces "one report per (deck, reporter)" — a re-report is a no-op. */
    Optional<DeckReport> findByDeckIdAndReporterId(UUID deckId, String reporterId);

    List<DeckReport> findByStatusOrderByCreatedAtDesc(String status);

    List<DeckReport> findAllByOrderByCreatedAtDesc();
}
