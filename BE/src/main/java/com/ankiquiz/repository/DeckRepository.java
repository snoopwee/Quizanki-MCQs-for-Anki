package com.ankiquiz.repository;

import com.ankiquiz.entity.Deck;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DeckRepository extends JpaRepository<Deck, UUID> {

    List<Deck> findAllByUserIdOrderByImportedAtDesc(String userId);

    Optional<Deck> findByIdAndUserId(UUID id, String userId);

    /**
     * The Discover listing: public decks, newest-shared first, optionally filtered
     * by a case-insensitive name fragment and a card-count range. Backed by the
     * partial index added in V10 (`decks_public_idx`) for the is_public + ordering.
     * A blank query and null bounds each mean "no restriction".
     *
     * <p>Returns a {@link Page} so the caller gets the total count for the pager in
     * the same round trip — the count query below shares the exact same filters.
     */
    @Query(value = """
            select d from Deck d
            where d.isPublic = true
              and (:q = '' or lower(d.name) like lower(concat('%', :q, '%')))
              and (:minCards is null or d.cardCount >= :minCards)
              and (:maxCards is null or d.cardCount <= :maxCards)
            order by d.sharedAt desc
            """,
            countQuery = """
            select count(d) from Deck d
            where d.isPublic = true
              and (:q = '' or lower(d.name) like lower(concat('%', :q, '%')))
              and (:minCards is null or d.cardCount >= :minCards)
              and (:maxCards is null or d.cardCount <= :maxCards)
            """)
    Page<Deck> findPublicDecks(
            @Param("q") String q,
            @Param("minCards") Integer minCards,
            @Param("maxCards") Integer maxCards,
            Pageable pageable);

    /** How many copies people have taken of this deck. */
    long countByCloneSourceDeckId(UUID cloneSourceDeckId);
}
