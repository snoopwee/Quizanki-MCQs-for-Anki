package com.ankiquiz.service;

import com.ankiquiz.dto.response.FollowStatusResponse;
import com.ankiquiz.dto.response.FollowedAuthorResponse;
import com.ankiquiz.entity.Deck;
import com.ankiquiz.entity.Follow;
import com.ankiquiz.entity.Profile;
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
import java.util.Map;
import java.util.Optional;
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
    @Mock private ProfileService profiles;

    private final Instant nowInstant = Instant.parse("2026-09-23T11:00:00Z");
    private final Clock clock = Clock.fixed(nowInstant, ZoneOffset.UTC);
    private FollowService service;

    private final UUID deckId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new FollowService(follows, decks, notifications, profiles, clock);
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

    // One name: the username IS the display name, and the rename endpoint keeps them equal.
    private static Profile profile(String userId, String username) {
        Profile p = new Profile();
        p.setUserId(userId);
        p.setUsername(username);
        p.setDisplayName(username);
        return p;
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
    void followingTellsTheAuthorWhoItWas() {
        authorHasPublished();
        when(profiles.find(FOLLOWER)).thenReturn(java.util.Optional.of(profile(FOLLOWER, "thanh")));

        service.follow(FOLLOWER, AUTHOR);

        // Their USERNAME — the one name this app has — which exists even for somebody who has
        // never published anything, and that is most followers.
        verify(notifications).newFollower(AUTHOR, FOLLOWER, "thanh");
    }

    @Test
    void pressingFollowTwiceAnnouncesYouOnce() {
        authorHasPublished();
        when(follows.existsByFollowerIdAndAuthorId(FOLLOWER, AUTHOR)).thenReturn(true);

        service.follow(FOLLOWER, AUTHOR);

        verify(notifications, never()).newFollower(any(), any(), any());
    }

    @Test
    void unfollowingTellsThemNothing() {
        service.unfollow(FOLLOWER, AUTHOR);

        // Following is one-sided: they hear when somebody arrives, never when somebody leaves.
        verify(notifications, never()).newFollower(any(), any(), any());
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
    void somebodyWhoHasPublishedNothingCanStillBeFollowed() {
        // You follow people back off your follower list, and most followers are learners who have
        // never published. Since V33 they have a profile row and a real page, so this must work.
        when(profiles.find("learner")).thenReturn(Optional.of(profile("learner", "thanh")));
        when(follows.existsByFollowerIdAndAuthorId(FOLLOWER, "learner")).thenReturn(false);

        service.follow(FOLLOWER, "learner");

        verify(follows).save(any());
        // Not even asked for: a profile row already proves the user exists.
        verify(decks, never()).findPublicByAuthor("learner");
    }

    @Test
    void aUserWeHaveNeverHeardOfCannotBeFollowed() {
        // A 404 stops a made-up user id being confirmed by trying to follow it.
        when(profiles.find("nobody")).thenReturn(Optional.empty());
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
    void theFollowingListNamesPeopleByTheirUsernameNotTheDeckSnapshot() {
        when(follows.authorsFollowedBy(FOLLOWER)).thenReturn(List.of(AUTHOR));
        when(decks.findPublicByAuthors(List.of(AUTHOR)))
                .thenReturn(List.of(deck(AUTHOR, "JLPT N3 kanji")));
        when(profiles.findAll(List.of(AUTHOR)))
                .thenReturn(Map.of(AUTHOR, profile(AUTHOR, "maitran")));

        // The deck credits "Mai" from before a rename; the username is the current name, and it
        // is also the ONLY name a followed-back learner who never published has.
        assertThat(service.following(FOLLOWER).getFirst().authorName()).isEqualTo("maitran");
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

    // ── who follows you ──────────────────────────────────────────────────────

    @Test
    void anAuthorSeesWhoFollowsThem() {
        when(follows.followersOf(AUTHOR)).thenReturn(List.of(FOLLOWER, "user-2"));
        com.ankiquiz.entity.Profile named = profile(FOLLOWER, "thanh");
        named.setAvatarUrl("thanh.webp");
        when(profiles.findAll(List.of(FOLLOWER, "user-2")))
                .thenReturn(java.util.Map.of(FOLLOWER, named));

        List<com.ankiquiz.dto.response.FollowerResponse> rows = service.followers(AUTHOR, AUTHOR);

        assertThat(rows).hasSize(2);
        assertThat(rows.getFirst().username()).isEqualTo("thanh");
        assertThat(rows.getFirst().displayName()).isEqualTo("thanh");
        assertThat(rows.getFirst().avatarUrl()).isEqualTo("thanh.webp");
        // A follower we cannot name is still a follower — the row stays, the client shows the id.
        assertThat(rows.get(1).userId()).isEqualTo("user-2");
        assertThat(rows.get(1).displayName()).isNull();
        // One query for every name, not one each.
        verify(profiles).findAll(List.of(FOLLOWER, "user-2"));
    }

    @Test
    void nobodyElseSeesAnAuthorsFollowerList() {
        // The COUNT is public and sits under their name; the list is not. 404, not 403.
        assertThatThrownBy(() -> service.followers(FOLLOWER, AUTHOR))
                .isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.followers(null, AUTHOR))
                .isInstanceOf(NotFoundException.class);
        verify(follows, never()).followersOf(anyString());
    }

    @Test
    void anAuthorWithNoFollowersGetsAnEmptyListNotAQuery() {
        when(follows.followersOf(AUTHOR)).thenReturn(List.of());

        assertThat(service.followers(AUTHOR, AUTHOR)).isEmpty();

        verify(profiles, never()).findAll(any());
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
