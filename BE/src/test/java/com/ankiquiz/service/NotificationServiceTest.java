package com.ankiquiz.service;

import com.ankiquiz.dto.response.NotificationPage;
import com.ankiquiz.entity.Notification;
import com.ankiquiz.exception.NotFoundException;
import com.ankiquiz.repository.NotificationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

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
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The notification centre. The assertions that matter most are the ones about what is NOT written:
 * nobody hears about their own action, and an unread row about one deck doesn't stack up.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class NotificationServiceTest {

    private static final String USER = "user-1";
    private static final String STRANGER = "user-2";

    @Mock private NotificationRepository notifications;

    private final Instant nowInstant = Instant.parse("2026-09-22T08:00:00Z");
    private final Clock clock = Clock.fixed(nowInstant, ZoneOffset.UTC);
    private NotificationService service;

    private final UUID deckId = UUID.randomUUID();
    private final UUID notificationId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new NotificationService(notifications, clock);
    }

    private Notification row(String recipient, boolean read) {
        Notification n = new Notification();
        n.setId(notificationId);
        n.setUserId(recipient);
        n.setKind(NotificationKind.DECK_SHARED.wire());
        n.setTitle("Mai shared a deck with you");
        n.setBody("JLPT N3 kanji");
        n.setLink("/decks/" + deckId);
        n.setActorId("author-9");
        n.setActorName("Mai");
        n.setDeckId(deckId);
        n.setCreatedAt(OffsetDateTime.parse("2026-09-21T09:00:00Z"));
        n.setReadAt(read ? OffsetDateTime.parse("2026-09-21T10:00:00Z") : null);
        return n;
    }

    private Notification captureSaved() {
        ArgumentCaptor<Notification> saved = ArgumentCaptor.forClass(Notification.class);
        verify(notifications).save(saved.capture());
        return saved.getValue();
    }

    // ── read side ────────────────────────────────────────────────────────────────────────────

    @Test
    void thePanelAsksForOnePageNewestFirstAndCarriesTheBadgeCount() {
        Pageable expected = PageRequest.of(0, 20,
                Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id")));
        when(notifications.findByUserId(eq(USER), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(row(USER, false)), expected, 1));
        when(notifications.countByUserIdAndReadAtIsNull(USER)).thenReturn(3L);

        NotificationPage page = service.page(USER, 20, 0);

        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        verify(notifications).findByUserId(eq(USER), pageable.capture());
        assertThat(pageable.getValue().getPageNumber()).isZero();
        assertThat(pageable.getValue().getPageSize()).isEqualTo(20);
        // id breaks ties on created_at so a broadcast written in one instant can't hide a row.
        assertThat(pageable.getValue().getSort()).isEqualTo(
                Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id")));

        assertThat(page.items()).hasSize(1);
        assertThat(page.items().getFirst().kind()).isEqualTo("deck_shared");
        assertThat(page.items().getFirst().read()).isFalse();
        assertThat(page.items().getFirst().link()).isEqualTo("/decks/" + deckId);
        // The badge counts ALL unread, not just the unread ones on this page.
        assertThat(page.unread()).isEqualTo(3);
        assertThat(page.total()).isEqualTo(1);
    }

    @Test
    void aRowOffsetBecomesAPageNumberAndTheSizeIsCapped() {
        when(notifications.findByUserId(eq(USER), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of()));

        service.page(USER, 500, 100);

        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        verify(notifications).findByUserId(eq(USER), pageable.capture());
        assertThat(pageable.getValue().getPageSize()).isEqualTo(NotificationService.MAX_PAGE_SIZE);
        // 100 rows in at the capped size of 50 is page 2.
        assertThat(pageable.getValue().getPageNumber()).isEqualTo(2);
    }

    @Test
    void anAbsurdLimitOrNegativeOffsetStillProducesAValidPage() {
        when(notifications.findByUserId(eq(USER), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of()));

        service.page(USER, 0, -50);

        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        verify(notifications).findByUserId(eq(USER), pageable.capture());
        assertThat(pageable.getValue().getPageSize()).isEqualTo(1);
        assertThat(pageable.getValue().getPageNumber()).isZero();
    }

    @Test
    void aReadRowReportsItselfRead() {
        when(notifications.findByUserId(eq(USER), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(row(USER, true))));

        assertThat(service.page(USER, 20, 0).items().getFirst().read()).isTrue();
    }

    // ── marking read ─────────────────────────────────────────────────────────────────────────

    @Test
    void markingReadStampsTheClock() {
        when(notifications.findByIdAndUserId(notificationId, USER))
                .thenReturn(Optional.of(row(USER, false)));

        service.markRead(USER, notificationId);

        assertThat(captureSaved().getReadAt()).isEqualTo(OffsetDateTime.ofInstant(nowInstant, ZoneOffset.UTC));
    }

    @Test
    void markingAnAlreadyReadOneIsNotAnErrorAndWritesNothing() {
        when(notifications.findByIdAndUserId(notificationId, USER))
                .thenReturn(Optional.of(row(USER, true)));

        service.markRead(USER, notificationId);

        verify(notifications, never()).save(any());
    }

    @Test
    void someoneElsesNotificationIs404NotForbidden() {
        // The repository is always asked with BOTH id and recipient, so a stranger's id simply
        // isn't found — it must not be confirmable.
        when(notifications.findByIdAndUserId(notificationId, STRANGER)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.markRead(STRANGER, notificationId))
                .isInstanceOf(NotFoundException.class);
        verify(notifications, never()).save(any());
    }

    @Test
    void markAllReadReportsHowManyWereStillUnread() {
        when(notifications.markAllRead(eq(USER), any(OffsetDateTime.class))).thenReturn(4);

        assertThat(service.markAllRead(USER)).isEqualTo(4);
        verify(notifications).markAllRead(USER, OffsetDateTime.ofInstant(nowInstant, ZoneOffset.UTC));
    }

    // ── write side ───────────────────────────────────────────────────────────────────────────

    @Test
    void aSharedDeckIsWrittenAsASnapshotWithSomewhereToGo() {
        assertThat(service.deckShared(USER, "author-9", "Mai", deckId, "JLPT N3 kanji")).isTrue();

        Notification saved = captureSaved();
        assertThat(saved.getUserId()).isEqualTo(USER);
        assertThat(saved.getKind()).isEqualTo("deck_shared");
        assertThat(saved.getTitle()).isEqualTo("Mai shared a deck with you");
        assertThat(saved.getBody()).isEqualTo("JLPT N3 kanji");
        assertThat(saved.getLink()).isEqualTo("/decks/" + deckId);
        assertThat(saved.getActorId()).isEqualTo("author-9");
        assertThat(saved.getActorName()).isEqualTo("Mai");
        assertThat(saved.getDeckId()).isEqualTo(deckId);
        assertThat(saved.getReadAt()).isNull();
        assertThat(saved.getCreatedAt()).isEqualTo(OffsetDateTime.ofInstant(nowInstant, ZoneOffset.UTC));
    }

    @Test
    void nobodyIsToldAboutTheirOwnAction() {
        // An author publishing a deck is the clearest case: their own followers' notification must
        // not land in their own bell.
        assertThat(service.authorPublished(USER, USER, "Mai", deckId, "JLPT N3 kanji")).isFalse();

        verify(notifications, never()).save(any());
    }

    @Test
    void anUnreadRowAboutOneDeckDoesNotStackUp() {
        when(notifications.existsByUserIdAndKindAndDeckIdAndReadAtIsNull(USER, "deck_shared", deckId))
                .thenReturn(true);

        assertThat(service.deckShared(USER, "author-9", "Mai", deckId, "JLPT N3 kanji")).isFalse();
        verify(notifications, never()).save(any());
    }

    @Test
    void onceReadTheSameDeckCanBeNewsAgain() {
        when(notifications.existsByUserIdAndKindAndDeckIdAndReadAtIsNull(USER, "deck_shared", deckId))
                .thenReturn(false);

        assertThat(service.deckShared(USER, "author-9", "Mai", deckId, "JLPT N3 kanji")).isTrue();
        verify(notifications).save(any());
    }

    @Test
    void aDifferentKindAboutTheSameDeckIsNotADuplicate() {
        when(notifications.existsByUserIdAndKindAndDeckIdAndReadAtIsNull(USER, "deck_shared", deckId))
                .thenReturn(true);

        assertThat(service.authorPublished(USER, "author-9", "Mai", deckId, "JLPT N3 kanji")).isTrue();
    }

    @Test
    void amissingActorNameStillReadsLikeASentence() {
        service.authorPublished(USER, "author-9", "  ", deckId, "JLPT N3 kanji");

        assertThat(captureSaved().getTitle()).isEqualTo("An author you follow published a new deck");
    }

    @Test
    void aBlankRecipientIsDroppedRatherThanWritten() {
        assertThat(service.deckShared("  ", "author-9", "Mai", deckId, "Deck")).isFalse();
        verify(notifications, never()).save(any());
    }

    @Test
    void anAnnouncementFansOutOncePerPersonWithNoActorAndNoDeck() {
        int sent = service.announce(List.of(USER, STRANGER, USER, "  "),
                "Scheduled maintenance", "We'll be down for ten minutes tonight.", "/help");

        assertThat(sent).isEqualTo(2);
        ArgumentCaptor<Notification> saved = ArgumentCaptor.forClass(Notification.class);
        verify(notifications, org.mockito.Mockito.times(2)).save(saved.capture());
        assertThat(saved.getAllValues()).extracting(Notification::getUserId)
                .containsExactly(USER, STRANGER);
        assertThat(saved.getAllValues()).allSatisfy(n -> {
            assertThat(n.getKind()).isEqualTo("announcement");
            assertThat(n.getActorId()).isNull();
            assertThat(n.getDeckId()).isNull();
            assertThat(n.getTitle()).isEqualTo("Scheduled maintenance");
            assertThat(n.getLink()).isEqualTo("/help");
        });
    }

    @Test
    void anAnnouncementWithNoTitleIsRefusedAndNoRecipientsMeansNoWork() {
        assertThatThrownBy(() -> service.announce(List.of(USER), " ", "body", null))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(service.announce(null, "Title", null, null)).isZero();
        verify(notifications, never()).save(any());
    }

    @Test
    void aBroadcastCannotPasteAnUnrenderableWallOfTextIntoTheRow() {
        service.announce(List.of(USER), "t".repeat(400), "b".repeat(900), null);

        Notification saved = captureSaved();
        assertThat(saved.getTitle()).hasSize(NotificationService.MAX_TITLE + 1).endsWith("…");
        assertThat(saved.getBody()).hasSize(NotificationService.MAX_BODY + 1).endsWith("…");
    }

    @Test
    void anEmptyBodyIsStoredAsNullRatherThanAnEmptyString() {
        service.deckShared(USER, "author-9", "Mai", deckId, "   ");

        assertThat(captureSaved().getBody()).isNull();
    }

    @Test
    void writingANotificationAlsoRetiresThatUsersAncientOnes() {
        service.deckShared(USER, "author-9", "Mai", deckId, "JLPT N3 kanji");

        // Scoped to the recipient so it rides the (user_id, created_at) index.
        verify(notifications).deleteOlderThan(USER,
                OffsetDateTime.ofInstant(nowInstant, ZoneOffset.UTC).minusDays(NotificationService.RETENTION_DAYS));
    }

    @Test
    void aDroppedNotificationDoesNotTriggerHousekeeping() {
        when(notifications.existsByUserIdAndKindAndDeckIdAndReadAtIsNull(USER, "deck_shared", deckId))
                .thenReturn(true);

        service.deckShared(USER, "author-9", "Mai", deckId, "JLPT N3 kanji");

        verify(notifications, never()).deleteOlderThan(anyString(), any(OffsetDateTime.class));
    }

    @Test
    void unreadCountIsJustACount() {
        when(notifications.countByUserIdAndReadAtIsNull(USER)).thenReturn(7L);

        assertThat(service.unreadCount(USER)).isEqualTo(7);
    }

    @Test
    void everyKindsWireValueMatchesWhatTheMigrationAllows() {
        // V27's notifications_kind_check lists exactly these three; a drift here is a 500 on write.
        assertThat(List.of(NotificationKind.values())).extracting(NotificationKind::wire)
                .containsExactly("deck_shared", "author_published", "announcement");
    }

    @Test
    void aDeckLessShareHasNoLinkToOffer() {
        assertThat(service.deckShared(USER, "author-9", "Mai", null, "Deck")).isTrue();
        assertThat(captureSaved().getLink()).isNull();
    }

    @Test
    void aLinkThatWouldLeaveTheAppIsDroppedButTheRowStillGoesOut() {
        // The admin endpoint already refuses these with a 400; this is the backstop for any other
        // producer, and it must not cost the user the notification itself.
        for (String offSite : java.util.List.of("https://evil.example", "//evil.example",
                "javascript:alert(1)", "/\\evil.example", "help")) {
            org.mockito.Mockito.clearInvocations(notifications);
            assertThat(service.announce(List.of(USER), "Heads up", "Body", offSite)).isEqualTo(1);
            assertThat(captureSaved().getLink()).as(offSite).isNull();
        }
    }

    @Test
    void aPlainInAppPathIsKeptAndTrimmed() {
        service.announce(List.of(USER), "Heads up", null, "  /help  ");

        assertThat(captureSaved().getLink()).isEqualTo("/help");
    }

    @Test
    void anEmptyLinkIsStoredAsNull() {
        service.announce(List.of(USER), "Heads up", null, "   ");

        assertThat(captureSaved().getLink()).isNull();
    }

    // ── deleting ─────────────────────────────────────────────────────────────

    @Test
    void deletingOneAddressesItByRecipientTooAndSaysWhetherItWent() {
        when(notifications.deleteByIdAndUserId(notificationId, USER)).thenReturn(1L);

        assertThat(service.delete(USER, notificationId)).isTrue();
        verify(notifications).deleteByIdAndUserId(notificationId, USER);
    }

    @Test
    void deletingSomethingAlreadyGoneOrNotYoursIsNotAnError() {
        // Same answer either way: a stranger's id must stay unconfirmable, and a double-click
        // shouldn't surface an error for work that is already done.
        when(notifications.deleteByIdAndUserId(any(UUID.class), anyString())).thenReturn(0L);

        assertThat(service.delete(USER, notificationId)).isFalse();
        assertThat(service.delete(STRANGER, notificationId)).isFalse();
    }

    @Test
    void clearingEmptiesOnlyTheCallersBellAndReportsTheCount() {
        when(notifications.deleteAllForUser(USER)).thenReturn(9);

        assertThat(service.clear(USER)).isEqualTo(9);
        verify(notifications).deleteAllForUser(USER);
        verify(notifications, never()).deleteAllForUser(STRANGER);
    }
}
