package com.ankiquiz.service;

import com.ankiquiz.dto.response.DeckRatingResponse;
import com.ankiquiz.entity.Deck;
import com.ankiquiz.entity.DeckRating;
import com.ankiquiz.exception.ConflictException;
import com.ankiquiz.exception.NotFoundException;
import com.ankiquiz.repository.DeckRatingRepository;
import com.ankiquiz.repository.DeckRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

/**
 * Deck ratings: a public score, and a note only the deck's author can read.
 *
 * The rules that hold throughout:
 * <ul>
 *   <li><b>You can only rate a deck you may open</b> ({@code findStudiable}) — the same test the
 *       rest of the app uses — and <b>never your own</b>.</li>
 *   <li><b>A note is private.</b> The only note this class hands back is the caller's own, echoed
 *       to them so they can edit it. Other people's notes leave the database through the
 *       author-only endpoint and nowhere else.</li>
 *   <li><b>The aggregate is recomputed, never adjusted.</b> Every write re-reads the deck's ratings
 *       and rewrites both columns, so no path can leave a wrong number on Discover.</li>
 * </ul>
 */
@Service
public class DeckRatingService {

    /** Matches DeckRatingRequest; a note longer than this is clipped rather than refused twice. */
    static final int MAX_NOTE = 1000;

    private final DeckRatingRepository ratings;
    private final DeckRepository decks;
    private final Clock clock;

    public DeckRatingService(DeckRatingRepository ratings, DeckRepository decks, Clock clock) {
        this.ratings = ratings;
        this.decks = decks;
        this.clock = clock;
    }

    /** The deck's score plus the caller's own rating, for the deck page. */
    @Transactional(readOnly = true)
    public DeckRatingResponse get(String userId, UUID deckId) {
        Deck deck = requireStudiable(userId, deckId);
        return toResponse(deck, ratings.findByDeckIdAndUserId(deckId, userId).orElse(null));
    }

    /** Rate a deck, or change a rating already given. */
    @Transactional
    public DeckRatingResponse rate(String userId, UUID deckId, int stars, String note) {
        Deck deck = requireStudiable(userId, deckId);
        if (userId.equals(deck.getUserId())) {
            // Defence in depth — the client doesn't offer the control on your own deck. A 409 with
            // a readable message, because the client shows the backend's wording.
            throw new ConflictException("You can't rate your own deck.");
        }
        if (stars < 1 || stars > 5) {
            throw new ConflictException("A rating is 1 to 5 stars.");
        }

        OffsetDateTime now = OffsetDateTime.now(clock);
        DeckRating rating = ratings.findByDeckIdAndUserId(deckId, userId).orElseGet(() -> {
            DeckRating fresh = new DeckRating();
            fresh.setDeckId(deckId);
            fresh.setUserId(userId);
            fresh.setCreatedAt(now);
            return fresh;
        });
        rating.setStars((short) stars);
        rating.setNote(clip(note));
        rating.setUpdatedAt(now);
        ratings.save(rating);

        return afterWrite(deckId, rating);
    }

    /**
     * Take back your own rating. Idempotent: removing a rating you never gave is not an error, it
     * is the state you asked for.
     */
    @Transactional
    public DeckRatingResponse remove(String userId, UUID deckId) {
        requireStudiable(userId, deckId);
        ratings.deleteByDeckIdAndUserId(deckId, userId);
        return afterWrite(deckId, null);
    }

    /** Re-reads the deck so the response carries the aggregate this write just produced. */
    private DeckRatingResponse afterWrite(UUID deckId, DeckRating mine) {
        ratings.refreshAggregate(deckId);
        Deck deck = decks.findById(deckId)
                .orElseThrow(() -> new NotFoundException("Deck not found: " + deckId));
        return toResponse(deck, mine);
    }

    private Deck requireStudiable(String userId, UUID deckId) {
        // Not-found rather than forbidden: a deck you can't open shouldn't be confirmable by id.
        return decks.findStudiable(deckId, userId)
                .orElseThrow(() -> new NotFoundException("Deck not found: " + deckId));
    }

    private static DeckRatingResponse toResponse(Deck deck, DeckRating mine) {
        int count = deck.getRatingCount();
        // Exact integer sum / count, rounded to one decimal for display; 0 reads as "not rated yet".
        double average = count == 0 ? 0 : Math.round((deck.getRatingSum() * 10.0) / count) / 10.0;
        return new DeckRatingResponse(
                count,
                average,
                Optional.ofNullable(mine).map(r -> (int) r.getStars()).orElse(null),
                Optional.ofNullable(mine).map(DeckRating::getNote).orElse(null));
    }

    private static String clip(String note) {
        if (note == null) {
            return null;
        }
        String trimmed = note.strip();
        if (trimmed.isEmpty()) {
            return null;
        }
        return trimmed.length() <= MAX_NOTE ? trimmed : trimmed.substring(0, MAX_NOTE).strip();
    }
}
