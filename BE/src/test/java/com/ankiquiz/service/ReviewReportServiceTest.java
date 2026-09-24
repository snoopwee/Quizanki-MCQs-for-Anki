package com.ankiquiz.service;

import com.ankiquiz.dto.response.AdminReviewReportResponse;
import com.ankiquiz.entity.Deck;
import com.ankiquiz.entity.DeckRating;
import com.ankiquiz.entity.ReviewReport;
import com.ankiquiz.exception.NotFoundException;
import com.ankiquiz.repository.DeckRatingRepository;
import com.ankiquiz.repository.DeckRepository;
import com.ankiquiz.repository.ReviewReportRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.web.server.ResponseStatusException;

import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Reported notes. The assertions worth having are about what the report keeps (the text, so an
 * admin still has something to judge) and what moderation must not take (the rating).
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ReviewReportServiceTest {

    private static final String AUTHOR = "author-9";
    private static final String STRANGER = "user-1";
    private static final String ADMIN = "admin-1";

    @Mock private ReviewReportRepository reports;
    @Mock private DeckRatingRepository ratings;
    @Mock private DeckRepository decks;
    @Mock private NotificationService notifications;
    @Mock private AdminUserService adminUsers;

    private final Instant nowInstant = Instant.parse("2026-09-23T09:00:00Z");
    private final Clock clock = Clock.fixed(nowInstant, ZoneOffset.UTC);
    private ReviewReportService service;

    private final UUID deckId = UUID.randomUUID();
    private final UUID noteId = UUID.randomUUID();
    private final UUID reportId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new ReviewReportService(reports, ratings, decks, notifications, adminUsers, clock);
    }

    private Deck deck() {
        Deck d = new Deck();
        d.setId(deckId);
        d.setUserId(AUTHOR);
        d.setName("JLPT N3 kanji");
        when(decks.findById(deckId)).thenReturn(Optional.of(d));
        return d;
    }

    private DeckRating note(String text) {
        DeckRating r = new DeckRating();
        r.setDeckId(deckId);
        r.setUserId("rater-2");
        r.setPublicId(noteId);
        r.setStars((short) 2);
        r.setNote(text);
        when(ratings.findByDeckIdAndPublicId(deckId, noteId)).thenReturn(Optional.of(r));
        return r;
    }

    private ReviewReport filed(String status) {
        ReviewReport report = new ReviewReport();
        report.setId(reportId);
        report.setRatingPublicId(noteId);
        report.setDeckId(deckId);
        report.setReporterId(AUTHOR);
        report.setNoteSnapshot("this deck is rubbish and so are you");
        report.setStatus(status);
        report.setCreatedAt(OffsetDateTime.parse("2026-09-22T09:00:00Z"));
        when(reports.findById(reportId)).thenReturn(Optional.of(report));
        return report;
    }

    private ReviewReport captureSaved() {
        ArgumentCaptor<ReviewReport> saved = ArgumentCaptor.forClass(ReviewReport.class);
        verify(reports).save(saved.capture());
        return saved.getValue();
    }

    // ── filing ───────────────────────────────────────────────────────────────

    @Test
    void aReportKeepsACopyOfTheTextItIsAbout() {
        deck();
        note("this deck is rubbish and so are you");

        assertThat(service.report(AUTHOR, deckId, noteId, "Abusive", "Third time this week"))
                .isTrue();

        ReviewReport saved = captureSaved();
        // The whole point: the author can clear the note a second later, and an admin would
        // otherwise be judging an empty report.
        assertThat(saved.getNoteSnapshot()).isEqualTo("this deck is rubbish and so are you");
        assertThat(saved.getRatingPublicId()).isEqualTo(noteId);
        assertThat(saved.getReporterId()).isEqualTo(AUTHOR);
        assertThat(saved.getReason()).isEqualTo("Abusive");
        assertThat(saved.getDetails()).isEqualTo("Third time this week");
        assertThat(saved.getStatus()).isEqualTo("open");
        assertThat(saved.getCreatedAt()).isEqualTo(OffsetDateTime.ofInstant(nowInstant, ZoneOffset.UTC));
    }

    @Test
    void reportingWithoutSayingWhyIsAllowed() {
        deck();
        note("something nasty");

        service.report(AUTHOR, deckId, noteId, "  ", null);

        ReviewReport saved = captureSaved();
        assertThat(saved.getReason()).isNull();
        assertThat(saved.getDetails()).isNull();
    }

    @Test
    void onlyTheDecksAuthorCanReportANoteOnIt() {
        deck();
        note("something nasty");

        // Nobody else can even read the note, so this is 404 rather than 403.
        assertThatThrownBy(() -> service.report(STRANGER, deckId, noteId, null, null))
                .isInstanceOf(NotFoundException.class);
        verify(reports, never()).save(any());
    }

    @Test
    void aNoteThatIsGoneCannotBeReported() {
        deck();
        note(null);

        assertThatThrownBy(() -> service.report(AUTHOR, deckId, noteId, null, null))
                .isInstanceOf(NotFoundException.class);

        when(ratings.findByDeckIdAndPublicId(deckId, noteId)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.report(AUTHOR, deckId, noteId, null, null))
                .isInstanceOf(NotFoundException.class);
        verify(reports, never()).save(any());
    }

    @Test
    void reportingTheSameNoteTwiceIsANoOpRatherThanASecondRow() {
        deck();
        note("something nasty");
        when(reports.existsByRatingPublicIdAndReporterId(noteId, AUTHOR)).thenReturn(true);

        assertThat(service.report(AUTHOR, deckId, noteId, null, null)).isFalse();
        verify(reports, never()).save(any());
    }

    @Test
    void aReportAlsoRecordsWhoWroteTheNote() {
        deck();
        note("this deck is rubbish and so are you");
        when(adminUsers.displayNameOf("rater-2")).thenReturn(Optional.of("Troublesome Tim"));

        service.report(AUTHOR, deckId, noteId, "Abusive", null);

        ReviewReport saved = captureSaved();
        // Snapshot, not a lookup through the rating: an admin takedown DELETES the rating, so
        // resolving identity later would fail right after the first moderation action.
        assertThat(saved.getWriterId()).isEqualTo("rater-2");
        assertThat(saved.getWriterName()).isEqualTo("Troublesome Tim");
    }

    @Test
    void aFailedNameLookupStillFilesTheReport() {
        deck();
        note("this deck is rubbish and so are you");
        // Supabase down, or the name simply not set. Reporting abuse must not depend on it.
        when(adminUsers.displayNameOf("rater-2")).thenReturn(Optional.empty());

        assertThat(service.report(AUTHOR, deckId, noteId, null, null)).isTrue();

        ReviewReport saved = captureSaved();
        assertThat(saved.getWriterName()).isNull();
        // The id is what identifies the account, and it never depends on an outside call.
        assertThat(saved.getWriterId()).isEqualTo("rater-2");
    }

    @Test
    void theWriterIsStillOnTheReportAfterTheRatingIsTakenDown() {
        ReviewReport report = filed("open");
        report.setWriterId("rater-2");
        report.setWriterName("Troublesome Tim");
        note("this deck is rubbish and so are you");

        service.takeDownRating(reportId, "Because.");

        // The whole reason for the snapshot: the rating is gone, and the account is still reachable.
        when(reports.findByStatusOrderByCreatedAtDesc("open")).thenReturn(List.of(report));
        Deck theDeck = deck();
        when(decks.findAllById(List.of(deckId))).thenReturn(List.of(theDeck));
        when(ratings.findByDeckIdAndPublicId(deckId, noteId)).thenReturn(Optional.empty());

        AdminReviewReportResponse row = service.list("open", null).getFirst();
        assertThat(row.ratingStillThere()).isFalse();
        assertThat(row.writerId()).isEqualTo("rater-2");
        assertThat(row.writerName()).isEqualTo("Troublesome Tim");
    }

    // ── the queue ────────────────────────────────────────────────────────────

    @Test
    void theQueueShowsTheSnapshotAndWhetherTheNoteIsStillLive() {
        ReviewReport report = filed("open");
        when(reports.findByStatusOrderByCreatedAtDesc("open")).thenReturn(List.of(report));
        Deck theDeck = deck();
        when(decks.findAllById(List.of(deckId))).thenReturn(List.of(theDeck));
        note("this deck is rubbish and so are you");

        List<AdminReviewReportResponse> rows = service.list("open", null);

        assertThat(rows).hasSize(1);
        assertThat(rows.getFirst().noteSnapshot()).isEqualTo("this deck is rubbish and so are you");
        assertThat(rows.getFirst().deckName()).isEqualTo("JLPT N3 kanji");
        assertThat(rows.getFirst().ratingStillThere()).isTrue();
    }

    @Test
    void aQueueRowSurvivesTheNoteBeingTakenDown() {
        ReviewReport report = filed("open");
        when(reports.findByStatusOrderByCreatedAtDesc("open")).thenReturn(List.of(report));
        Deck theDeck = deck();
        when(decks.findAllById(List.of(deckId))).thenReturn(List.of(theDeck));
        // Cleared by the author after reporting, or the rating deleted outright.
        when(ratings.findByDeckIdAndPublicId(deckId, noteId)).thenReturn(Optional.empty());

        List<AdminReviewReportResponse> rows = service.list("open", null);

        assertThat(rows.getFirst().noteSnapshot()).isEqualTo("this deck is rubbish and so are you");
        assertThat(rows.getFirst().ratingStillThere()).isFalse();
    }

    @Test
    void theQueueNamesBothSidesForTheAdmin() {
        ReviewReport report = filed("open");
        when(reports.findAllByOrderByCreatedAtDesc()).thenReturn(List.of(report));
        Deck theDeck = deck();
        when(decks.findAllById(List.of(deckId))).thenReturn(List.of(theDeck));
        note("something nasty");

        AdminReviewReportResponse row = service.list(null, null).getFirst();

        // Both sides are named for the admin: the reporter (so they can be answered) and the
        // writer (so a repeat offender can be reached). The AUTHOR's own feedback page still shows
        // neither — that is DeckFeedbackResponse, which has nowhere to put a name.
        assertThat(row.reporterId()).isEqualTo(AUTHOR);
    }

    // ── admin actions ────────────────────────────────────────────────────────

    @Test
    void resolvingTellsTheReporterWhatHappened() {
        filed("open");
        deck();

        service.updateStatus(reportId, "resolved", ADMIN, "Because.");

        ReviewReport saved = captureSaved();
        assertThat(saved.getStatus()).isEqualTo("resolved");
        assertThat(saved.getResolvedBy()).isEqualTo(ADMIN);
        assertThat(saved.getResolvedAt()).isEqualTo(OffsetDateTime.ofInstant(nowInstant, ZoneOffset.UTC));
        verify(notifications).reportReviewed(AUTHOR, deckId, "JLPT N3 kanji", true);
    }

    @Test
    void dismissingAlsoTellsThemRatherThanLeavingThemWondering() {
        filed("open");
        deck();

        service.updateStatus(reportId, "DISMISSED", ADMIN, "Because.");

        assertThat(captureSaved().getStatus()).isEqualTo("dismissed");
        // Same notification, different outcome flag — a black hole is the thing being avoided.
        verify(notifications).reportReviewed(AUTHOR, deckId, "JLPT N3 kanji", false);
    }

    @Test
    void onlyResolvedOrDismissedAreAcceptedStatuses() {
        filed("open");

        assertThatThrownBy(() -> service.updateStatus(reportId, "deleted", ADMIN, "Because."))
                .isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> service.updateStatus(reportId, null, ADMIN, "Because."))
                .isInstanceOf(ResponseStatusException.class);
        verify(reports, never()).save(any());
        verify(notifications, never()).reportReviewed(any(), any(), any(), anyBoolean());
    }

    @Test
    void anUnknownReportIs404() {
        when(reports.findById(reportId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.updateStatus(reportId, "resolved", ADMIN, "Because."))
                .isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.takeDownRating(reportId, "Because.")).isInstanceOf(NotFoundException.class);
    }

    @Test
    void anAdminTakeDownRemovesTheWholeRating() {
        filed("open");
        DeckRating rating = note("this deck is rubbish and so are you");

        assertThat(service.takeDownRating(reportId, "Because.")).isTrue();

        // Stars and note together. The note is private and the star is public, so clearing only
        // the text would leave the abuser's mark on the score and take away the one thing the
        // author could see. The reason box plus an admin reading it is the safeguard, not a rule
        // that ties their hands.
        verify(ratings).delete(rating);
        // A star has gone, so the deck's public score has to be recomputed.
        verify(ratings).refreshAggregate(deckId);
    }

    @Test
    void aRatingWhoseNoteTheAuthorAlreadyClearedCanStillBeTakenDown() {
        filed("open");
        DeckRating starsOnly = note(null);

        // The star is the public half; it outlives the text and is still actionable.
        assertThat(service.takeDownRating(reportId, "Because.")).isTrue();
        verify(ratings).delete(starsOnly);
    }

    @Test
    void takingDownARatingThatIsAlreadyGoneIsNotAnError() {
        filed("open");
        when(ratings.findByDeckIdAndPublicId(deckId, noteId)).thenReturn(Optional.empty());

        assertThat(service.takeDownRating(reportId, "Because.")).isFalse();
        verify(ratings, never()).delete(any(DeckRating.class));
        verify(ratings, never()).refreshAggregate(any());
    }

    // ── telling the person it happened to, and forgetting closed reports (V37) ──

    @Test
    void aTakeDownTellsTheWriterTheirRatingWasRemoved() {
        ReviewReport report = filed("open");
        report.setWriterId("writer-1");
        deck();
        note("this deck is rubbish and so are you");

        service.takeDownRating(reportId, "Because.");

        // Until this existed only the REPORTER heard an outcome; the person actually moderated
        // just found their rating gone, with no lesson and nothing to appeal.
        // …and the admin's grounds go with it, which is why the API refuses a bare takedown.
        verify(notifications).contentRemoved("writer-1", deckId, "JLPT N3 kanji", "Because.");
    }

    @Test
    void aTakeDownOnAReportTooOldToNameTheWriterStillRemovesIt() {
        filed("open");  // no writerId — predates the V31 snapshot
        note("older than the writer column");

        assertThat(service.takeDownRating(reportId, "Because.")).isTrue();

        // The takedown does not depend on being able to tell anybody. It asks either way and
        // NotificationService drops a delivery with no recipient — one guard, in one place.
        verify(notifications).contentRemoved(isNull(), eq(deckId), any(), any());
    }

    @Test
    void closingAReportStartsItsFifteenDayClock() {
        filed("open");

        service.updateStatus(reportId, "resolved", ADMIN, "Because.");

        // Evidence while the decision is live, clutter afterwards.
        assertThat(captureSaved().getPurgeAfter())
                .isEqualTo(OffsetDateTime.now(clock).plusDays(15));
    }

    @Test
    void thePurgeOnlyEverCatchesReportsPastTheirDate() {
        when(reports.deleteByPurgeAfterBefore(any())).thenReturn(3);

        assertThat(service.purgeExpired()).isEqualTo(3);

        // An OPEN report has no date at all, so it can never be swept — it is still somebody's
        // outstanding work.
        verify(reports).deleteByPurgeAfterBefore(OffsetDateTime.now(clock));
    }

    @Test
    void theClosedFilterIsResolvedAndDismissedTogether() {
        when(reports.findByStatusNotOrderByCreatedAtDesc("open")).thenReturn(List.of());

        service.list("closed", null);

        // An admin sorting finished work from outstanding work doesn't care which way it went.
        verify(reports).findByStatusNotOrderByCreatedAtDesc("open");
        verify(reports, never()).findAllByOrderByCreatedAtDesc();
    }
}
