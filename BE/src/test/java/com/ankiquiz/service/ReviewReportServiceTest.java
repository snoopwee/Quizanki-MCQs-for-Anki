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

    private final Instant nowInstant = Instant.parse("2026-09-23T09:00:00Z");
    private final Clock clock = Clock.fixed(nowInstant, ZoneOffset.UTC);
    private ReviewReportService service;

    private final UUID deckId = UUID.randomUUID();
    private final UUID noteId = UUID.randomUUID();
    private final UUID reportId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new ReviewReportService(reports, ratings, decks, notifications, clock);
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

    // ── the queue ────────────────────────────────────────────────────────────

    @Test
    void theQueueShowsTheSnapshotAndWhetherTheNoteIsStillLive() {
        ReviewReport report = filed("open");
        when(reports.findByStatusOrderByCreatedAtDesc("open")).thenReturn(List.of(report));
        Deck theDeck = deck();
        when(decks.findAllById(List.of(deckId))).thenReturn(List.of(theDeck));
        note("this deck is rubbish and so are you");

        List<AdminReviewReportResponse> rows = service.list("open");

        assertThat(rows).hasSize(1);
        assertThat(rows.getFirst().noteSnapshot()).isEqualTo("this deck is rubbish and so are you");
        assertThat(rows.getFirst().deckName()).isEqualTo("JLPT N3 kanji");
        assertThat(rows.getFirst().noteStillThere()).isTrue();
    }

    @Test
    void aQueueRowSurvivesTheNoteBeingTakenDown() {
        ReviewReport report = filed("open");
        when(reports.findByStatusOrderByCreatedAtDesc("open")).thenReturn(List.of(report));
        Deck theDeck = deck();
        when(decks.findAllById(List.of(deckId))).thenReturn(List.of(theDeck));
        // Cleared by the author after reporting, or the rating deleted outright.
        when(ratings.findByDeckIdAndPublicId(deckId, noteId)).thenReturn(Optional.empty());

        List<AdminReviewReportResponse> rows = service.list("open");

        assertThat(rows.getFirst().noteSnapshot()).isEqualTo("this deck is rubbish and so are you");
        assertThat(rows.getFirst().noteStillThere()).isFalse();
    }

    @Test
    void theQueueCarriesNoIdentityForWhoeverWroteTheNote() {
        ReviewReport report = filed("open");
        when(reports.findAllByOrderByCreatedAtDesc()).thenReturn(List.of(report));
        Deck theDeck = deck();
        when(decks.findAllById(List.of(deckId))).thenReturn(List.of(theDeck));
        note("something nasty");

        AdminReviewReportResponse row = service.list(null).getFirst();

        // The reporter is named (they are the author, and an admin may need to answer them); the
        // writer is not. Acting on a person goes through the user tools instead.
        assertThat(row.reporterId()).isEqualTo(AUTHOR);
        assertThat(row.toString()).doesNotContain("rater-2");
    }

    // ── admin actions ────────────────────────────────────────────────────────

    @Test
    void resolvingTellsTheReporterWhatHappened() {
        filed("open");
        deck();

        service.updateStatus(reportId, "resolved", ADMIN);

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

        service.updateStatus(reportId, "DISMISSED", ADMIN);

        assertThat(captureSaved().getStatus()).isEqualTo("dismissed");
        // Same notification, different outcome flag — a black hole is the thing being avoided.
        verify(notifications).reportReviewed(AUTHOR, deckId, "JLPT N3 kanji", false);
    }

    @Test
    void onlyResolvedOrDismissedAreAcceptedStatuses() {
        filed("open");

        assertThatThrownBy(() -> service.updateStatus(reportId, "deleted", ADMIN))
                .isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> service.updateStatus(reportId, null, ADMIN))
                .isInstanceOf(ResponseStatusException.class);
        verify(reports, never()).save(any());
        verify(notifications, never()).reportReviewed(any(), any(), any(), anyBoolean());
    }

    @Test
    void anUnknownReportIs404() {
        when(reports.findById(reportId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.updateStatus(reportId, "resolved", ADMIN))
                .isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.deleteNote(reportId)).isInstanceOf(NotFoundException.class);
    }

    @Test
    void anAdminTakingANoteDownLeavesTheRatingStanding() {
        filed("open");
        DeckRating rating = note("this deck is rubbish and so are you");

        assertThat(service.deleteNote(reportId)).isTrue();

        ArgumentCaptor<DeckRating> saved = ArgumentCaptor.forClass(DeckRating.class);
        verify(ratings).save(saved.capture());
        assertThat(saved.getValue().getNote()).isNull();
        // Removing the score with the text would hand anyone a way to scrub a bad rating by
        // writing something reportable.
        assertThat(saved.getValue().getStars()).isEqualTo((short) 2);
        assertThat(rating.getStars()).isEqualTo((short) 2);
    }

    @Test
    void takingDownANoteThatIsAlreadyGoneIsNotAnError() {
        filed("open");
        note(null);

        assertThat(service.deleteNote(reportId)).isFalse();
        verify(ratings, never()).save(any());
    }
}
