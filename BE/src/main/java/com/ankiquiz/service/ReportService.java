package com.ankiquiz.service;

import com.ankiquiz.dto.response.AdminReportResponse;
import com.ankiquiz.entity.Deck;
import com.ankiquiz.entity.DeckReport;
import com.ankiquiz.exception.NotFoundException;
import com.ankiquiz.repository.DeckReportRepository;
import com.ankiquiz.repository.DeckRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * User deck reports + the admin queue that reviews them. A report is only accepted
 * for a deck the reporter can actually see (studiable), and is idempotent per
 * (deck, reporter). Listing/updating is admin-gated at the controller.
 */
@Service
public class ReportService {

    private static final Set<String> RESOLVABLE = Set.of("resolved", "dismissed");

    private final DeckReportRepository reportRepository;
    private final DeckRepository deckRepository;

    public ReportService(DeckReportRepository reportRepository, DeckRepository deckRepository) {
        this.reportRepository = reportRepository;
        this.deckRepository = deckRepository;
    }

    @Transactional
    public void report(String reporterId, UUID deckId, String reason, String details) {
        // Only decks the reporter can see (public/owned/saved). 404 (not 403) so a
        // report can't be used to probe for a private deck's existence.
        deckRepository.findStudiable(deckId, reporterId)
                .orElseThrow(() -> new NotFoundException("Deck not found: " + deckId));

        // One report per (deck, reporter) — a repeat is a silent no-op, not a dupe.
        if (reportRepository.findByDeckIdAndReporterId(deckId, reporterId).isPresent()) {
            return;
        }

        DeckReport report = new DeckReport();
        report.setDeckId(deckId);
        report.setReporterId(reporterId);
        report.setReason(trimToNull(reason));
        report.setDetails(trimToNull(details));
        report.setStatus("open");
        report.setCreatedAt(OffsetDateTime.now());
        reportRepository.save(report);
    }

    @Transactional(readOnly = true)
    public List<AdminReportResponse> listReports(String status, String reason) {
        String want = status == null ? "" : status.trim().toLowerCase();
        // "closed" is resolved AND dismissed: an admin sorting finished work from outstanding work
        // does not care which way it went, only that it is done.
        List<DeckReport> reports = switch (want) {
            case "" -> reportRepository.findAllByOrderByCreatedAtDesc();
            case "closed" -> reportRepository.findByStatusNotOrderByCreatedAtDesc("open");
            default -> reportRepository.findByStatusOrderByCreatedAtDesc(want);
        };
        // Narrowed in memory: small queue, client-owned vocabulary, and the table is swept every
        // fifteen days — an index would cost more than it saves.
        String wantReason = reason == null ? "" : reason.trim();
        if (!wantReason.isEmpty()) {
            reports = reports.stream()
                    .filter(r -> wantReason.equalsIgnoreCase(r.getReason()))
                    .toList();
        }
        if (reports.isEmpty()) {
            return List.of();
        }
        // Batch-load the reported decks for their name/author (no per-row query).
        Map<UUID, Deck> decks = deckRepository
                .findAllById(reports.stream().map(DeckReport::getDeckId).distinct().toList())
                .stream()
                .collect(Collectors.toMap(Deck::getId, Function.identity()));

        return reports.stream().map(r -> {
            Deck d = decks.get(r.getDeckId());
            return new AdminReportResponse(
                    r.getId(), r.getDeckId(),
                    d == null ? null : d.getName(),
                    d == null ? null : d.getAuthorName(),
                    r.getReporterId(), r.getReason(), r.getDetails(), r.getStatus(),
                    r.getResolutionNote(), r.getCreatedAt());
        }).toList();
    }

    @Transactional
    public void updateStatus(UUID reportId, String status, String adminId, String note) {
        String next = status == null ? "" : status.trim().toLowerCase();
        if (!RESOLVABLE.contains(next)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Status must be resolved or dismissed.");
        }
        DeckReport report = reportRepository.findById(reportId)
                .orElseThrow(() -> new NotFoundException("Report not found: " + reportId));
        OffsetDateTime now = OffsetDateTime.now();
        report.setStatus(next);
        report.setResolvedAt(now);
        report.setResolvedBy(adminId);
        // A closed report is evidence for a while and clutter afterwards. An OPEN one never gets a
        // date: it is still somebody's outstanding work.
        report.setPurgeAfter(now.plusDays(ReviewReportService.REPORT_RETENTION_DAYS));
        // Internal: the next admin reading this row is the audience.
        report.setResolutionNote(trimToNull(note));
        reportRepository.save(report);
    }

    /** How many deck reports are still waiting — the admin badge. */
    @Transactional(readOnly = true)
    public long openCount() {
        return reportRepository.countByStatus("open");
    }

    /**
     * Delete closed reports whose time is up. Safe at any time: an open report has no date, so it
     * can never be caught by this.
     */
    @Transactional
    public int purgeExpired() {
        return reportRepository.deleteByPurgeAfterBefore(OffsetDateTime.now());
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
