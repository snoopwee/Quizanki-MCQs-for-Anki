package com.ankiquiz.repository;

import com.ankiquiz.entity.DeckRating;
import com.ankiquiz.entity.DeckRatingId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DeckRatingRepository extends JpaRepository<DeckRating, DeckRatingId> {

    Optional<DeckRating> findByDeckIdAndUserId(UUID deckId, String userId);

    long deleteByDeckIdAndUserId(UUID deckId, String userId);

    /** The author's feedback page: only the ratings that actually carry a note, newest first. */
    List<DeckRating> findByDeckIdAndNoteIsNotNullOrderByUpdatedAtDesc(UUID deckId);

    /** How many notes are waiting, for the button that opens that page. */
    int countByDeckIdAndNoteIsNotNull(UUID deckId);

    /**
     * One rating by its opaque handle, scoped to the deck so a handle from another deck cannot be
     * used against this one.
     */
    Optional<DeckRating> findByDeckIdAndPublicId(UUID deckId, UUID publicId);

    /**
     * Recompute the deck's aggregate from the ratings themselves.
     *
     * Deliberately a full recount rather than incremental arithmetic (+new −old): rating, re-rating
     * and un-rating would each need their own correction, and any missed path leaves a wrong number
     * on Discover forever. This is a handful of rows behind the primary key, and it is self-healing
     * — if the columns ever drift, the next rating on that deck fixes them.
     */
    @Modifying
    @Query(value = """
            update decks set
                rating_count = (select count(*) from deck_ratings where deck_id = :deckId),
                rating_sum   = (select coalesce(sum(stars), 0) from deck_ratings where deck_id = :deckId)
            where id = :deckId
            """, nativeQuery = true)
    void refreshAggregate(@Param("deckId") UUID deckId);
}
