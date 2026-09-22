package com.ankiquiz.service;

import com.ankiquiz.dto.response.DeckRatingResponse;
import com.ankiquiz.entity.Deck;
import com.ankiquiz.entity.DeckRating;
import com.ankiquiz.exception.ConflictException;
import com.ankiquiz.exception.NotFoundException;
import com.ankiquiz.repository.DeckRatingRepository;
import com.ankiquiz.repository.DeckRepository;
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
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Deck ratings. The assertions that matter most are the boundaries of the design: you cannot rate
 * your own deck, a note you send back is only ever your own, and the aggregate is recomputed rather
 * than adjusted.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class DeckRatingServiceTest {

    private static final String RATER = "user-1";
    private static final String OWNER = "author-9";

    @Mock private DeckRatingRepository ratings;
    @Mock private DeckRepository decks;

    private final Instant nowInstant = Instant.parse("2026-09-22T10:00:00Z");
    private final Clock clock = Clock.fixed(nowInstant, ZoneOffset.UTC);
    private DeckRatingService service;

    private final UUID deckId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new DeckRatingService(ratings, decks, clock);
    }

    private Deck deck(String owner, int count, int sum) {
        Deck d = new Deck();
        d.setId(deckId);
        d.setUserId(owner);
        d.setName("JLPT N3 kanji");
        d.setRatingCount(count);
        d.setRatingSum(sum);
        return d;
    }

    private void deckIsStudiable(Deck deck) {
        when(decks.findStudiable(deckId, RATER)).thenReturn(Optional.of(deck));
        when(decks.findStudiable(deckId, OWNER)).thenReturn(Optional.of(deck));
        when(decks.findById(deckId)).thenReturn(Optional.of(deck));
    }

    private DeckRating existing(String userId, int stars, String note) {
        DeckRating r = new DeckRating();
        r.setDeckId(deckId);
        r.setUserId(userId);
        r.setStars((short) stars);
        r.setNote(note);
        r.setCreatedAt(OffsetDateTime.parse("2026-09-01T00:00:00Z"));
        r.setUpdatedAt(OffsetDateTime.parse("2026-09-01T00:00:00Z"));
        return r;
    }

    private DeckRating captureSaved() {
        ArgumentCaptor<DeckRating> saved = ArgumentCaptor.forClass(DeckRating.class);
        verify(ratings).save(saved.capture());
        return saved.getValue();
    }

    @Test
    void ratingADeckStoresStarsAndTheNoteAndStampsTheClock() {
        deckIsStudiable(deck(OWNER, 1, 4));

        service.rate(RATER, deckId, 4, "  Clear examples, good audio.  ");

        DeckRating saved = captureSaved();
        assertThat(saved.getDeckId()).isEqualTo(deckId);
        assertThat(saved.getUserId()).isEqualTo(RATER);
        assertThat(saved.getStars()).isEqualTo((short) 4);
        assertThat(saved.getNote()).isEqualTo("Clear examples, good audio.");
        assertThat(saved.getCreatedAt()).isEqualTo(OffsetDateTime.ofInstant(nowInstant, ZoneOffset.UTC));
        assertThat(saved.getUpdatedAt()).isEqualTo(OffsetDateTime.ofInstant(nowInstant, ZoneOffset.UTC));
    }

    @Test
    void ratingAgainReplacesTheOldOneAndKeepsWhenItWasFirstGiven() {
        deckIsStudiable(deck(OWNER, 1, 2));
        when(ratings.findByDeckIdAndUserId(deckId, RATER))
                .thenReturn(Optional.of(existing(RATER, 2, "Was rough.")));

        service.rate(RATER, deckId, 5, "Much better since the update.");

        DeckRating saved = captureSaved();
        assertThat(saved.getStars()).isEqualTo((short) 5);
        assertThat(saved.getNote()).isEqualTo("Much better since the update.");
        assertThat(saved.getCreatedAt()).isEqualTo(OffsetDateTime.parse("2026-09-01T00:00:00Z"));
        assertThat(saved.getUpdatedAt()).isEqualTo(OffsetDateTime.ofInstant(nowInstant, ZoneOffset.UTC));
    }

    @Test
    void youCannotRateYourOwnDeck() {
        deckIsStudiable(deck(OWNER, 0, 0));

        assertThatThrownBy(() -> service.rate(OWNER, deckId, 5, "Mine is great"))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("your own deck");
        verify(ratings, never()).save(any());
    }

    @Test
    void aDeckYouCannotOpenIs404NotForbidden() {
        // Private and not yours: the id must not be confirmable by a rating attempt.
        when(decks.findStudiable(deckId, RATER)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.rate(RATER, deckId, 5, null))
                .isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.get(RATER, deckId)).isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.remove(RATER, deckId)).isInstanceOf(NotFoundException.class);
        verify(ratings, never()).save(any());
    }

    @Test
    void starsOutsideOneToFiveAreRefused() {
        deckIsStudiable(deck(OWNER, 0, 0));

        assertThatThrownBy(() -> service.rate(RATER, deckId, 0, null)).isInstanceOf(ConflictException.class);
        assertThatThrownBy(() -> service.rate(RATER, deckId, 6, null)).isInstanceOf(ConflictException.class);
        verify(ratings, never()).save(any());
    }

    @Test
    void anEmptyNoteIsStoredAsNullAndALongOneIsClipped() {
        deckIsStudiable(deck(OWNER, 0, 0));

        service.rate(RATER, deckId, 3, "   ");
        assertThat(captureSaved().getNote()).isNull();

        org.mockito.Mockito.clearInvocations(ratings);
        service.rate(RATER, deckId, 3, "n".repeat(DeckRatingService.MAX_NOTE + 50));
        assertThat(captureSaved().getNote()).hasSize(DeckRatingService.MAX_NOTE);
    }

    @Test
    void everyWriteRecomputesTheAggregateRatherThanAdjustingIt() {
        deckIsStudiable(deck(OWNER, 0, 0));

        service.rate(RATER, deckId, 4, null);
        verify(ratings).refreshAggregate(deckId);

        org.mockito.Mockito.clearInvocations(ratings);
        service.remove(RATER, deckId);
        verify(ratings).refreshAggregate(deckId);
    }

    @Test
    void removingARatingYouNeverGaveIsNotAnError() {
        deckIsStudiable(deck(OWNER, 0, 0));
        when(ratings.deleteByDeckIdAndUserId(deckId, RATER)).thenReturn(0L);

        DeckRatingResponse response = service.remove(RATER, deckId);

        assertThat(response.myStars()).isNull();
        assertThat(response.myNote()).isNull();
    }

    @Test
    void theScoreIsTheExactSumOverTheCountRoundedForDisplay() {
        // 17 ratings totalling 71 stars = 4.176…, shown as 4.2.
        deckIsStudiable(deck(OWNER, 17, 71));

        DeckRatingResponse response = service.get(RATER, deckId);

        assertThat(response.count()).isEqualTo(17);
        assertThat(response.average()).isEqualTo(4.2);
    }

    @Test
    void anUnratedDeckReadsAsZeroRatherThanPretendingToHaveAScore() {
        deckIsStudiable(deck(OWNER, 0, 0));

        DeckRatingResponse response = service.get(RATER, deckId);

        assertThat(response.count()).isZero();
        assertThat(response.average()).isZero();
        assertThat(response.myStars()).isNull();
    }

    @Test
    void theOnlyNoteHandedBackIsTheCallersOwn() {
        deckIsStudiable(deck(OWNER, 2, 9));
        when(ratings.findByDeckIdAndUserId(deckId, RATER))
                .thenReturn(Optional.of(existing(RATER, 4, "Mine, for the author.")));

        DeckRatingResponse response = service.get(RATER, deckId);

        // Their own, echoed so they can edit it — never somebody else's, which only the deck's
        // author may read, through its own endpoint.
        assertThat(response.myStars()).isEqualTo(4);
        assertThat(response.myNote()).isEqualTo("Mine, for the author.");
        verify(ratings).findByDeckIdAndUserId(deckId, RATER);
    }
}
