package com.ankiquiz.service;

import com.ankiquiz.dto.response.FollowStatusResponse;
import com.ankiquiz.dto.response.FollowedAuthorResponse;
import com.ankiquiz.entity.Deck;
import com.ankiquiz.entity.Follow;
import com.ankiquiz.exception.ConflictException;
import com.ankiquiz.exception.NotFoundException;
import com.ankiquiz.repository.DeckRepository;
import com.ankiquiz.repository.FollowRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Following an author. The interesting assertions are the ones about what a follow is NOT: not
 * mutual, not announced to the author, and not creatable against an arbitrary user id.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class FollowServiceTest {

    private static final String FOLLOWER = "user-1";
    private static final String AUTHOR = "author-9";

    @Mock private FollowRepository follows;
    @Mock private DeckRepository decks;
    @Mock private NotificationService notifications;

    private final Instant nowInstant = Instant.parse("2026-09-23T11:00:00Z");
    private final Clock clock = Clock.fixed(nowInstant, ZoneOffset.UTC);
    private FollowService service;

    private final UUID deckId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new FollowService(follows, decks, notifications, clock);
    }

    private Deck deck(String authorId, String name) {
        Deck d = new Deck();
        d.setId(deckId);
        d.setUserId(authorId);
        d.setAuthorId(authorId);
        d.setAuthorName("Mai");
        d.setAuthorAvatarUrl("https://example.test/mai.webp");
        d.setName(name);
        d.setPublic(true);
        return d;
    }

    private void authorHasPublished() {
        when(decks.findPublicByAuthor(AUTHOR)).thenReturn(List.of(deck(AUTHOR, "JLPT N3 kanji")));
    }

    @Test
    void followingStoresOneRowAndStampsTheClock() {
        authorHasPublished();
        when(follows.countByAuthorId(AUTHOR)).thenReturn(1L);

        FollowStatusResponse status = service.follow(FOLLOWER, AUTHOR);

        ArgumentCaptor<Follow> saved = ArgumentCaptor.forClass(Follow.class);
        verify(follows).save(saved.capture());
        assertThat(saved.getValue().getFollowerId()).isEqualTo(FOLLOWER);
        assertThat(saved.getValue().getAuthorId()).isEqualTo(AUTHOR);
        assertThat(saved.getValue().getCreatedAt())
                .isEqualTo(OffsetDateTime.ofInstant(nowInstant, ZoneOffset.UTC));
        assertThat(status.followers()).isEqualTo(1);
    }

    @Test
    void followingTwiceLeavesOneRow() {
        authorHasPublished();
        when(follows.existsByFollowerIdAndAuthorId(FOLLOWER, AUTHOR)).thenReturn(true);

        service.follow(FOLLOWER, AUTHOR);

        verify(follows, never()).save(any());
    }

    @Test
    void followingYourselfIsRefused() {
        assertThatThrownBy(() -> service.follow(AUTHOR, AUTHOR))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("yourself");
        verify(follows, never()).save(any());
    }

    @Test
    void anAuthorWithNothingPublishedCannotBeFollowed() {
        // There is no author page to subscribe to — and a 404 stops an arbitrary user id being
        // confirmed by trying to follow it.
        when(decks.findPublicByAuthor("nobody")).thenReturn(List.of());

        assertThatThrownBy(() -> service.follow(FOLLOWER, "nobody"))
                .isInstanceOf(NotFoundException.class);
        verify(follows, never()).save(any());
    }

    @Test
    void unfollowingSomeoneYouNeverFollowedIsNotAnError() {
        when(follows.deleteByFollowerIdAndAuthorId(FOLLOWER, AUTHOR)).thenReturn(0L);

        FollowStatusResponse status = service.unfollow(FOLLOWER, AUTHOR);

        assertThat(status.following()).isFalse();
        // No author check either: you can always stop following, even an author who has since
        // unpublished everything.
        verify(decks, never()).findPublicByAuthor(anyString());
    }

    @Test
    void anAuthorLookingAtTheirOwnPageIsToldItIsThem() {
        when(follows.countByAuthorId(AUTHOR)).thenReturn(12L);

        FollowStatusResponse status = service.status(AUTHOR, AUTHOR);

        // So the client shows no button at all, rather than one that would be refused.
        assertThat(status.self()).isTrue();
        assertThat(status.following()).isFalse();
        assertThat(status.followers()).isEqualTo(12);
    }

    @Test
    void aGuestSeesTheCountButNoFollowState() {
        when(follows.countByAuthorId(AUTHOR)).thenReturn(12L);

        FollowStatusResponse status = service.status(null, AUTHOR);

        assertThat(status.following()).isFalse();
        assertThat(status.self()).isFalse();
        assertThat(status.followers()).isEqualTo(12);
    }

    @Test
    void theFollowingListCarriesEachAuthorsNameAndDeckCount() {
        when(follows.authorsFollowedBy(FOLLOWER)).thenReturn(List.of(AUTHOR));
        when(decks.findPublicByAuthors(List.of(AUTHOR)))
                .thenReturn(List.of(deck(AUTHOR, "JLPT N3 kanji"), deck(AUTHOR, "Kana drills")));

        List<FollowedAuthorResponse> rows = service.following(FOLLOWER);

        assertThat(rows).hasSize(1);
        assertThat(rows.getFirst().authorName()).isEqualTo("Mai");
        assertThat(rows.getFirst().authorAvatarUrl()).isEqualTo("https://example.test/mai.webp");
        assertThat(rows.getFirst().publicDecks()).isEqualTo(2);
    }

    @Test
    void anAuthorWhoUnpublishedEverythingStillAppearsInTheList() {
        when(follows.authorsFollowedBy(FOLLOWER)).thenReturn(List.of(AUTHOR));
        when(decks.findPublicByAuthors(List.of(AUTHOR))).thenReturn(List.of());

        FollowedAuthorResponse row = service.following(FOLLOWER).getFirst();

        // The follow outlives their decks; the client shows the id rather than dropping the row.
        assertThat(row.authorId()).isEqualTo(AUTHOR);
        assertThat(row.authorName()).isNull();
        assertThat(row.publicDecks()).isZero();
    }

    @Test
    void theFollowingListAsksForEveryAuthorsDecksInOneQuery() {
        when(follows.authorsFollowedBy(FOLLOWER)).thenReturn(List.of(AUTHOR, "author-2", "author-3"));
        when(decks.findPublicByAuthors(any())).thenReturn(List.of());

        service.following(FOLLOWER);

        // Not one lookup per author followed.
        verify(decks).findPublicByAuthors(List.of(AUTHOR, "author-2", "author-3"));
        verify(decks, never()).findPublicByAuthor(anyString());
    }

    // ── publishing ───────────────────────────────────────────────────────────

    @Test
    void publishingNotifiesTheAuthorsFollowersThroughTheBatchedPath() {
        Deck published = deck(AUTHOR, "JLPT N3 kanji");
        when(follows.followersOf(AUTHOR)).thenReturn(List.of(FOLLOWER, "user-2"));
        when(notifications.authorPublishedToMany(any(), any(), any(), any(), any())).thenReturn(2);

        assertThat(service.announcePublished(published)).isEqualTo(2);

        verify(notifications).authorPublishedToMany(
                List.of(FOLLOWER, "user-2"), AUTHOR, "Mai", deckId, "JLPT N3 kanji");
    }

    @Test
    void anAuthorWithNoFollowersCostsNothingToPublish() {
        when(follows.followersOf(AUTHOR)).thenReturn(List.of());

        assertThat(service.announcePublished(deck(AUTHOR, "JLPT N3 kanji"))).isZero();

        verify(notifications, never()).authorPublishedToMany(any(), any(), any(), any(), any());
    }
}
