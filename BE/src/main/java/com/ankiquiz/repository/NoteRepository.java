package com.ankiquiz.repository;

import com.ankiquiz.entity.Note;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface NoteRepository extends JpaRepository<Note, UUID> {

    List<Note> findAllByDeckIdAndAnkiNoteIdIn(UUID deckId, Collection<String> ankiNoteIds);

    List<Note> findAllByDeckIdOrderById(UUID deckId);

    // Editor/study display order. position is set by import and the editor; id is a
    // stable tiebreaker for any row whose position is null (pre-V4 leftovers).
    List<Note> findAllByDeckIdOrderByPositionAscIdAsc(UUID deckId);

    Optional<Note> findByIdAndDeckId(UUID id, UUID deckId);

    long countByDeckId(UUID deckId);

    /**
     * Filtered note fetch for a deck.
     * - tagsCsv empty → no tag filter; otherwise AND-containment via array @>.
     * - weakOnly true → notes with no card_stats row OR accuracy < 0.7.
     * - starredOnly true → notes whose card_stats row has starred = true (a
     *   missing row means unstarred, so the LEFT JOIN null is correctly excluded).
     */
    @Query(value = """
            SELECT n.* FROM notes n
            LEFT JOIN card_stats cs ON cs.note_id = n.id
            WHERE n.deck_id = :deckId
              AND (:tagsCsv = '' OR n.tags @> string_to_array(:tagsCsv, ','))
              AND (:weakOnly = FALSE OR cs.note_id IS NULL OR cs.accuracy < 0.7)
              AND (:starredOnly = FALSE OR cs.starred = TRUE)
            ORDER BY n.note_position, n.id
            LIMIT :limit
            """, nativeQuery = true)
    List<Note> findFiltered(
            @Param("deckId") UUID deckId,
            @Param("tagsCsv") String tagsCsv,
            @Param("weakOnly") boolean weakOnly,
            @Param("starredOnly") boolean starredOnly,
            @Param("limit") int limit
    );
}
