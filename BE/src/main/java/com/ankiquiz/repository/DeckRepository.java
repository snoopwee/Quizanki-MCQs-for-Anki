package com.ankiquiz.repository;

import com.ankiquiz.entity.Deck;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
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
     * A deck the user may STUDY / open / duplicate: one they own, any public deck,
     * OR one they've SAVED to their library. The saved grant is what keeps a
     * bookmarked deck accessible after its owner unshares it — "private" only
     * removes it from Discovery, it doesn't revoke savers (V12). This is the access
     * gate for read/study paths; mutations (edit/delete/share) stay
     * {@link #findByIdAndUserId}. Absent reads as 404, never 403.
     */
    @Query("""
            select d from Deck d
            where d.id = :deckId
              and (d.userId = :userId
                   or d.isPublic = true
                   or exists (select 1 from UserDeck ud
                              where ud.deckId = d.id and ud.userId = :userId and ud.saved = true))
            """)
    Optional<Deck> findStudiable(@Param("deckId") UUID deckId, @Param("userId") String userId);

    /** An author's public decks, newest-shared first — backs the author page. */
    @Query("select d from Deck d where d.authorId = :authorId and d.isPublic = true order by d.sharedAt desc")
    List<Deck> findPublicByAuthor(@Param("authorId") String authorId);

    /** Decks the user has SAVED (bookmarked) that they don't own — the Saved tab. */
    @Query("""
            select d from Deck d, UserDeck ud
            where ud.deckId = d.id and ud.userId = :userId and ud.saved = true and d.userId <> :userId
            order by ud.lastOpenedAt desc nulls last
            """)
    List<Deck> findSavedByUser(@Param("userId") String userId);

    /** Decks the user opened since {@code since}, newest first — the Recent tab. */
    @Query("""
            select d from Deck d, UserDeck ud
            where ud.deckId = d.id and ud.userId = :userId and ud.lastOpenedAt >= :since
            order by ud.lastOpenedAt desc
            """)
    List<Deck> findRecentByUser(@Param("userId") String userId,
                                @Param("since") java.time.OffsetDateTime since);

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

    /**
     * Refresh the credited name on every deck this user AUTHORS (not owns) to their
     * current display name. author_name is denormalised (no user table to join), so
     * a profile rename would otherwise leave old decks showing the old name until
     * their next edit. Returns how many rows changed.
     */
    @Modifying
    @Query("update Deck d set d.authorName = :name, d.authorAvatarUrl = :avatarUrl where d.authorId = :userId")
    int updateAuthorProfile(@Param("userId") String userId,
                            @Param("name") String name,
                            @Param("avatarUrl") String avatarUrl);
}
