package com.ankiquiz.repository;

import com.ankiquiz.entity.NoteType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface NoteTypeRepository extends JpaRepository<NoteType, UUID> {

    List<NoteType> findAllByDeckId(UUID deckId);
}
