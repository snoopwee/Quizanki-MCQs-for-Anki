package com.ankiquiz.service;

import com.ankiquiz.dto.response.AdminReviewReportResponse;
import com.ankiquiz.entity.Deck;
import com.ankiquiz.entity.DeckRating;
import com.ankiquiz.entity.Profile;
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

    /** How long a closed report is kept. Long enough to revisit a decision, short enough to forget. */
    public static final int REPORT_RETENTION_DAYS = 15;

    private final ReviewReportRepository reports;
    private final DeckRatingRepository ratings;
    private final DeckRepository decks;
    private final NotificationService notifications;
    private final AdminUserService adminUsers;
    private final ProfileService profiles;
    private final Clock clock;

    public ReviewReportService(ReviewReportRepository reports, DeckRatingRepository ratings,
                               DeckRepository decks, NotificationService notifications,
                               AdminUserService adminUsers, ProfileService profiles, Clock clock) {
        this.reports = reports;
        this.ratings = ratings;
        this.decks = decks;
        this.notifications = notifications;
        this.adminUsers = adminUsers;
        this.profiles = profiles;
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
        // Their username first — it is the one name this app has, and it is local. The Supabase
        // Admin API is the fallback for somebody with no profile row; a failure there leaves this
        // null and keeps the id, because an outage must not stop anybody reporting abuse.
        report.setWriterName(profiles.find(rating.getUserId())
                .map(Profile::getUsername)
                .filter(name -> name != null && !name.isBlank())
                .or(() -> adminUsers.displayNameOf(rating.getUserId()))
                .orElse(null));
        report.setStatus("open");
        report.setCreatedAt(OffsetDateTime.now(clock));
        reports.save(report);
        return true;
    }

    /**
     * Delete closed reports whose time is up. Called by the scheduler, and safe to run at any time:
     * an open report has no date, so it can never be caught by this.
     *
     * @return how many were removed.
     */
    @Transactional
    public int purgeExpired() {
        return reports.deleteByPurgeAfterBefore(OffsetDateTime.now(clock));
    }

    @Transactional(readOnly = true)
    public List<AdminReviewReportResponse> list(String status, String reason) {
        String want = status == null ? "" : status.trim().toLowerCase();
        // "closed" is resolved AND dismissed: an admin sorting finished work from outstanding work
        // does not care which way it went, only that it is done.
        List<ReviewReport> found = switch (want) {
            case "" -> reports.findAllByOrderByCreatedAtDesc();
            case "closed" -> reports.findByStatusNotOrderByCreatedAtDesc("open");
            default -> reports.findByStatusOrderByCreatedAtDesc(want);
        };
        // Narrowed in memory rather than in SQL: the queue is small, the reason vocabulary is
        // the client's, and a second index on a table that gets swept every fifteen days would
        // cost more than it saves.
        String wantReason = reason == null ? "" : reason.trim();
        if (!wantReason.isEmpty()) {
            found = found.stream()
                    .filter(r -> wantReason.equalsIgnoreCase(r.getReason()))
                    .toList();
        }
        if (found.isEmpty()) {
            return List.of();
        }
        // Batch-load the decks for their names rather than a query per row, as ReportService does.
        Map<UUID, Deck> byId = decks
                .findAllById(found.stream().map(ReviewReport::getDeckId).distinct().toList())
                .stream()
                .collect(Collectors.toMap(Deck::getId, Function.identity()));

        // One query for every writer's current name. The snapshot on the row is the fallback: it
        // exists so a takedown cannot erase who wrote the thing, but a live profile is fresher and
        // is what the admin will recognise.
        Map<String, Profile> writers = profiles.findAll(found.stream()
                .map(ReviewReport::getWriterId)
                .filter(id -> id != null && !id.isBlank())
                .distinct()
                .toList());

        return found.stream().map(r -> {
            Deck deck = byId.get(r.getDeckId());
            Profile writer = r.getWriterId() == null ? null : writers.get(r.getWriterId());
            String writerName = writer != null && writer.getUsername() != null
                    ? writer.getUsername()
                    : r.getWriterName();
            // Whether there is still a rating to act on. The note may already be cleared (by the
            // author) while the star stands — that rating can still be taken down.
            boolean live = ratings.findByDeckIdAndPublicId(r.getDeckId(), r.getRatingPublicId())
                    .isPresent();
            return new AdminReviewReportResponse(
                    r.getId(), r.getDeckId(), deck == null ? null : deck.getName(),
                    r.getReporterId(), r.getReason(), r.getDetails(), r.getNoteSnapshot(),
                    r.getWriterId(), writerName,
                    live, r.getStatus(), r.getResolutionNote(), r.getCreatedAt());
        }).toList();
    }

    /** Resolve or dismiss, and tell whoever reported it — otherwise the queue is a black hole. */
    @Transactional
    public void updateStatus(UUID reportId, String status, String adminId, String note) {
        String next = status == null ? "" : status.trim().toLowerCase();
        if (!RESOLVABLE.contains(next)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Status must be resolved or dismissed.");
        }
        close(require(reportId), next, adminId, note);
    }

    /**
     * Mark a report dealt with: status, who and when, the reason, and the retention clock — then
     * tell whoever reported it.
     *
     * <p>Shared by {@link #updateStatus} and {@link #takeDownRating} so the two cannot drift. A
     * takedown IS a resolution: removing the content is the most decisive answer a report can get,
     * and leaving it open afterwards left the badge counting work already done and the row with no
     * expiry, so it never aged out either.
     */
    private void close(ReviewReport report, String status, String adminId, String note) {
        OffsetDateTime now = OffsetDateTime.now(clock);
        report.setStatus(status);
        report.setResolvedAt(now);
        report.setResolvedBy(adminId);
        // A closed report is evidence for a while and clutter afterwards. An OPEN one never gets a
        // date: it is still somebody's outstanding work.
        report.setPurgeAfter(now.plusDays(REPORT_RETENTION_DAYS));
        report.setResolutionNote(trimToNull(note));
        reports.save(report);

        notifications.reportReviewed(report.getReporterId(), report.getDeckId(),
                deckName(report.getDeckId()), "resolved".equals(status));
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
    public boolean takeDownRating(UUID reportId, String note, String adminId) {
        ReviewReport report = require(reportId);
        Optional<DeckRating> found =
                ratings.findByDeckIdAndPublicId(report.getDeckId(), report.getRatingPublicId());
        if (found.isEmpty()) {
            // Nothing was removed, so nothing is decided — the report stays open rather than being
            // closed on the strength of an action that did not happen.
            return false;
        }
        ratings.delete(found.get());
        // A star has gone, so the deck's public score is stale until this runs.
        ratings.refreshAggregate(report.getDeckId());
        // And the writer is told. Until this existed only the REPORTER heard an outcome, and the
        // person actually moderated just found their rating gone — no lesson, and nothing to
        // appeal. The writer id is the snapshot taken when the report was filed, which is exactly
        // why it is snapshotted: the rating it would otherwise be read from has just been deleted.
        // The reason travels with it. That is why it is mandatory: "your rating was removed" with
        // no grounds gives somebody moderated by mistake nothing to appeal.
        String reason = trimToNull(note);
        notifications.contentRemoved(report.getWriterId(), report.getDeckId(),
                deckName(report.getDeckId()), reason);
        // Removing the content settles the report, with the reason already given. Making the admin
        // resolve it separately meant writing a second reason for the same decision, and until
        // they did the queue kept counting it.
        close(report, "resolved", adminId, reason);
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
