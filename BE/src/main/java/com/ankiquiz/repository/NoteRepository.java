package com.ankiquiz.repository;

import com.ankiquiz.entity.Note;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface NoteRepository extends JpaRepository<Note, UUID> {

    List<Note> findAllByDeckIdAndAnkiNoteIdIn(UUID deckId, Collection<String> ankiNoteIds);

    long countByDeckId(UUID deckId);

    /**
     * Filtered note fetch for a deck.
     * - tagsCsv empty → no tag filter; otherwise AND-containment via array @>.
     * - weakOnly true → notes with no card_stats row OR accuracy < 0.7.
     */
    @Query(value = """
            SELECT n.* FROM notes n
            LEFT JOIN card_stats cs ON cs.note_id = n.id
            WHERE n.deck_id = :deckId
              AND (:tagsCsv = '' OR n.tags @> string_to_array(:tagsCsv, ','))
              AND (:weakOnly = FALSE OR cs.note_id IS NULL OR cs.accuracy < 0.7)
            ORDER BY n.id
            LIMIT :limit
            """, nativeQuery = true)
    List<Note> findFiltered(
            @Param("deckId") UUID deckId,
            @Param("tagsCsv") String tagsCsv,
            @Param("weakOnly") boolean weakOnly,
            @Param("limit") int limit
    );
}
