package com.ankiquiz.repository;

import com.ankiquiz.entity.ReviewReport;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public interface ReviewReportRepository extends JpaRepository<ReviewReport, UUID> {

    List<ReviewReport> findAllByOrderByCreatedAtDesc();

    List<ReviewReport> findByStatusOrderByCreatedAtDesc(String status);

    /** Enforces "one report per (note, reporter)" — a re-report is a no-op, as for deck reports. */
    boolean existsByRatingPublicIdAndReporterId(UUID ratingPublicId, String reporterId);

    /** Everything that is NOT open — resolved and dismissed together, for the "Closed" filter. */
    List<ReviewReport> findByStatusNotOrderByCreatedAtDesc(String status);

    /** For the admin badge: how much is still waiting. */
    long countByStatus(String status);

    /** Retention sweep. Only closed reports carry a date, so an open one can never be caught. */
    int deleteByPurgeAfterBefore(OffsetDateTime cutoff);
}
