package com.ankiquiz.repository;

import com.ankiquiz.entity.Deck;
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
     * by a case-insensitive name fragment. Backed by the partial index added in
     * V10 (`decks_public_idx`). A blank query means "everything".
     */
    @Query("""
            select d from Deck d
            where d.isPublic = true
              and (:q = '' or lower(d.name) like lower(concat('%', :q, '%')))
            order by d.sharedAt desc
            """)
    List<Deck> findPublicDecks(@Param("q") String q, Pageable pageable);

    /** How many copies people have taken of this deck. */
    long countByCloneSourceDeckId(UUID cloneSourceDeckId);
}
