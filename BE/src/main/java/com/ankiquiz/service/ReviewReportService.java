package com.ankiquiz.service;

import com.ankiquiz.dto.response.AdminReviewReportResponse;
import com.ankiquiz.entity.Deck;
import com.ankiquiz.entity.DeckRating;
import com.ankiquiz.entity.ReviewReport;
import com.ankiquiz.exception.NotFoundException;
import com.ankiquiz.repository.DeckRatingRepository;
import com.ankiquiz.repository.DeckRepository;
import com.ankiquiz.repository.ReviewReportRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Reported rating notes, and the admin queue that reviews them.
 *
 * <p>Only a deck's author can report a note, because only they can read one. The report copies the
 * text: the author may clear the note (and the rater may delete the whole rating) the moment after
 * reporting it, and an admin judging an empty report would have to take the reporter's word for it.
 *
 * <p>The report also records WHO wrote the note (admin queue only — the author's feedback page
 * stays anonymous), because an admin takedown deletes the rating: without a snapshot, moderating
 * would be the act that destroys the route back to the account.
 *
 * <p>Deliberately separate from {@link ReportService}: deck reports are about something public that
 * anyone can go and look at, note reports are about text one person was shown. Sharing a table
 * would have meant widening a working flow to carry a column it has no use for.
 */
@Service
public class ReviewReportService {

    private static final Set<String> RESOLVABLE = Set.of("resolved", "dismissed");

    private final ReviewReportRepository reports;
    private final DeckRatingRepository ratings;
    private final DeckRepository decks;
    private final NotificationService notifications;
    private final AdminUserService adminUsers;
    private final Clock clock;

    public ReviewReportService(ReviewReportRepository reports, DeckRatingRepository ratings,
                               DeckRepository decks, NotificationService notifications,
                               AdminUserService adminUsers, Clock clock) {
        this.reports = reports;
        this.ratings = ratings;
        this.decks = decks;
        this.notifications = notifications;
        this.adminUsers = adminUsers;
        this.clock = clock;
    }

    /**
     * An author escalates a note on their deck. Idempotent per (note, reporter): reporting twice is
     * a silent no-op rather than a second row in the queue.
     *
     * @return whether a new report was filed.
     */
    @Transactional
    public boolean report(String authorId, UUID deckId, UUID notePublicId, String reason, String details) {
        requireOwned(authorId, deckId);
        DeckRating rating = ratings.findByDeckIdAndPublicId(deckId, notePublicId)
                .orElseThrow(() -> new NotFoundException("Note not found: " + notePublicId));
        if (rating.getNote() == null) {
            // Nothing to judge. A cleared note cannot be reported after the fact.
            throw new NotFoundException("Note not found: " + notePublicId);
        }
        if (reports.existsByRatingPublicIdAndReporterId(notePublicId, authorId)) {
            return false;
        }

        ReviewReport report = new ReviewReport();
        report.setRatingPublicId(notePublicId);
        report.setDeckId(deckId);
        report.setReporterId(authorId);
        report.setReason(trimToNull(reason));
        report.setDetails(trimToNull(details));
        // The snapshot is the whole point: the text has to survive being taken down.
        report.setNoteSnapshot(rating.getNote());
        // And so does the writer. An admin takedown deletes the rating, so resolving identity
        // through the rating later would fail exactly after the first moderation action — the
        // obvious move would destroy what a ban needs. The name is best-effort: a Supabase outage
        // must not stop somebody reporting abuse, so a failure leaves it null and keeps the id.
        report.setWriterId(rating.getUserId());
        report.setWriterName(adminUsers.displayNameOf(rating.getUserId()).orElse(null));
        report.setStatus("open");
        report.setCreatedAt(OffsetDateTime.now(clock));
        reports.save(report);
        return true;
    }

    @Transactional(readOnly = true)
    public List<AdminReviewReportResponse> list(String status) {
        List<ReviewReport> found = (status == null || status.isBlank())
                ? reports.findAllByOrderByCreatedAtDesc()
                : reports.findByStatusOrderByCreatedAtDesc(status.trim());
        if (found.isEmpty()) {
            return List.of();
        }
        // Batch-load the decks for their names rather than a query per row, as ReportService does.
        Map<UUID, Deck> byId = decks
                .findAllById(found.stream().map(ReviewReport::getDeckId).distinct().toList())
                .stream()
                .collect(Collectors.toMap(Deck::getId, Function.identity()));

        return found.stream().map(r -> {
            Deck deck = byId.get(r.getDeckId());
            // Whether there is still a rating to act on. The note may already be cleared (by the
            // author) while the star stands — that rating can still be taken down.
            boolean live = ratings.findByDeckIdAndPublicId(r.getDeckId(), r.getRatingPublicId())
                    .isPresent();
            return new AdminReviewReportResponse(
                    r.getId(), r.getDeckId(), deck == null ? null : deck.getName(),
                    r.getReporterId(), r.getReason(), r.getDetails(), r.getNoteSnapshot(),
                    r.getWriterId(), r.getWriterName(),
                    live, r.getStatus(), r.getCreatedAt());
        }).toList();
    }

    /** Resolve or dismiss, and tell whoever reported it — otherwise the queue is a black hole. */
    @Transactional
    public void updateStatus(UUID reportId, String status, String adminId) {
        String next = status == null ? "" : status.trim().toLowerCase();
        if (!RESOLVABLE.contains(next)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Status must be resolved or dismissed.");
        }
        ReviewReport report = require(reportId);
        report.setStatus(next);
        report.setResolvedAt(OffsetDateTime.now(clock));
        report.setResolvedBy(adminId);
        reports.save(report);

        notifications.reportReviewed(report.getReporterId(), report.getDeckId(),
                deckName(report.getDeckId()), "resolved".equals(next));
    }

    /**
     * An admin takes the whole rating down — <b>stars and note together</b> — and the deck's public
     * score is recomputed without it.
     *
     * <p>This is deliberately NOT the same as the author's own delete, which only ever clears text.
     * The note is private and the star is public: clearing only the text would leave the abuser's
     * mark on the score and remove the one thing the author could actually see, which rewards the
     * abuse. The safeguard against an author using reports to scrub bad ratings is the report's
     * reason box and an admin reading it — a person deciding, not a rule that ties their hands.
     *
     * @return whether a rating was actually removed.
     */
    @Transactional
    public boolean takeDownRating(UUID reportId) {
        ReviewReport report = require(reportId);
        Optional<DeckRating> found =
                ratings.findByDeckIdAndPublicId(report.getDeckId(), report.getRatingPublicId());
        if (found.isEmpty()) {
            return false;
        }
        ratings.delete(found.get());
        // A star has gone, so the deck's public score is stale until this runs.
        ratings.refreshAggregate(report.getDeckId());
        return true;
    }

    @Transactional(readOnly = true)
    public long openCount() {
        return reports.countByStatus("open");
    }

    private ReviewReport require(UUID reportId) {
        return reports.findById(reportId)
                .orElseThrow(() -> new NotFoundException("Report not found: " + reportId));
    }

    private Deck requireOwned(String userId, UUID deckId) {
        Deck deck = decks.findById(deckId)
                .orElseThrow(() -> new NotFoundException("Deck not found: " + deckId));
        // Not-found rather than forbidden, matching the feedback page: whether a deck has notes to
        // report is the author's business.
        if (!userId.equals(deck.getUserId())) {
            throw new NotFoundException("Deck not found: " + deckId);
        }
        return deck;
    }

    private String deckName(UUID deckId) {
        return decks.findById(deckId).map(Deck::getName).orElse(null);
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
