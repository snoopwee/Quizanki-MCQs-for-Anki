package com.ankiquiz.repository;

import com.ankiquiz.entity.FolderDeck;
import com.ankiquiz.entity.FolderDeckId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface FolderDeckRepository extends JpaRepository<FolderDeck, FolderDeckId> {

    List<FolderDeck> findAllByFolderIdOrderByAddedAtDesc(UUID folderId);

    /** Which folders hold this deck — for the deck page's "add to folder" list. */
    List<FolderDeck> findAllByDeckId(UUID deckId);

    void deleteByFolderIdAndDeckId(UUID folderId, UUID deckId);

    /** Deck counts for a whole folder list in one round trip, rather than one query per folder. */
    @Query("select fd.folderId, count(fd) from FolderDeck fd where fd.folderId in :folderIds group by fd.folderId")
    List<Object[]> countByFolderIds(@Param("folderIds") Collection<UUID> folderIds);
}
