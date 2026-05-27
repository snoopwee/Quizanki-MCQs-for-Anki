package com.ankiquiz.repository;

import com.ankiquiz.entity.Deck;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DeckRepository extends JpaRepository<Deck, UUID> {

    List<Deck> findAllByUserIdOrderByImportedAtDesc(String userId);

    Optional<Deck> findByIdAndUserId(UUID id, String userId);
}
