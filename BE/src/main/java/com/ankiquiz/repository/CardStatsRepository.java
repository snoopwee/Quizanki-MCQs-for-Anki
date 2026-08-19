package com.ankiquiz.repository;

import com.ankiquiz.entity.CardStats;
import com.ankiquiz.entity.CardStatsId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface CardStatsRepository extends JpaRepository<CardStats, CardStatsId> {

    // Progress is per (user, note), so every lookup is scoped to the acting user —
    // never fetch a row by note id alone (that would cross users).
    Optional<CardStats> findByUserIdAndNoteId(String userId, UUID noteId);

    List<CardStats> findByUserIdAndNoteIdIn(String userId, Collection<UUID> noteIds);
}
