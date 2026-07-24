package com.ankiquiz.repository;

import com.ankiquiz.entity.UserDeck;
import com.ankiquiz.entity.UserDeckId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserDeckRepository extends JpaRepository<UserDeck, UserDeckId> {

    Optional<UserDeck> findByUserIdAndDeckId(String userId, UUID deckId);

    boolean existsByUserIdAndDeckIdAndSavedTrue(String userId, UUID deckId);
}
