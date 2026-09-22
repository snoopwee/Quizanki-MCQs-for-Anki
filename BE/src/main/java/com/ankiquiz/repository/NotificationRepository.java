package com.ankiquiz.repository;

import com.ankiquiz.entity.Notification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

public interface NotificationRepository extends JpaRepository<Notification, UUID> {

    /** The panel's page. Sort comes from the caller's Pageable (created_at desc, id desc). */
    Page<Notification> findByUserId(String userId, Pageable pageable);

    /** The bell's badge — served by the partial index on unread rows. */
    long countByUserIdAndReadAtIsNull(String userId);

    /** Always by (id, recipient): another user's notification must not be reachable by id alone. */
    Optional<Notification> findByIdAndUserId(UUID id, String userId);

    /**
     * Whether this user already has an UNREAD notification of this kind about this deck — the
     * check that stops the same deck stacking up in the panel. Once read, a later one is allowed
     * through, because by then it is news again.
     */
    boolean existsByUserIdAndKindAndDeckIdAndReadAtIsNull(String userId, String kind, UUID deckId);

    @Modifying
    @Query("update Notification n set n.readAt = :now where n.userId = :userId and n.readAt is null")
    int markAllRead(@Param("userId") String userId, @Param("now") OffsetDateTime now);

    /**
     * Delete one, addressed by (id, recipient) so another user's row is simply not matched. Returns
     * how many went, which lets the caller answer identically whether the row was already gone or
     * never theirs.
     */
    long deleteByIdAndUserId(UUID id, String userId);

    /** Clear the whole bell in one statement rather than loading every row to delete it. */
    @Modifying
    @Query("delete from Notification n where n.userId = :userId")
    int deleteAllForUser(@Param("userId") String userId);

    /** Retention, scoped to one user so it rides the (user_id, created_at) index. */
    @Modifying
    @Query("delete from Notification n where n.userId = :userId and n.createdAt < :cutoff")
    int deleteOlderThan(@Param("userId") String userId, @Param("cutoff") OffsetDateTime cutoff);
}
