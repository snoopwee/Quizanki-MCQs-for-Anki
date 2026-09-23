package com.ankiquiz.repository;

import com.ankiquiz.entity.NotificationMute;
import com.ankiquiz.entity.NotificationMuteId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface NotificationMuteRepository extends JpaRepository<NotificationMute, NotificationMuteId> {

    boolean existsByUserIdAndKind(String userId, String kind);

    long deleteByUserIdAndKind(String userId, String kind);

    /** Everything this person has switched off — the settings screen, in one query. */
    @Query("select m.kind from NotificationMute m where m.userId = :userId")
    List<String> kindsMutedBy(@Param("userId") String userId);

    /**
     * Which of these people have switched this kind off. Asked once per fan-out, so that a
     * many-recipient notification does not check preferences one person at a time.
     */
    @Query("select m.userId from NotificationMute m where m.kind = :kind and m.userId in :userIds")
    List<String> mutingUsers(@Param("kind") String kind, @Param("userIds") Collection<String> userIds);
}
