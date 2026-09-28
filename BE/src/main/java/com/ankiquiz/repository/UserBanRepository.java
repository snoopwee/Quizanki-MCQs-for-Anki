package com.ankiquiz.repository;

import com.ankiquiz.entity.UserBan;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserBanRepository extends JpaRepository<UserBan, UUID> {

    /** The ban in force, if any. A partial unique index guarantees there is at most one. */
    Optional<UserBan> findByUserIdAndLiftedAtIsNull(String userId);

    /** Everything ever, newest first — the admin's view of a repeat offender. */
    List<UserBan> findByUserIdOrderByBannedAtDesc(String userId);

    /** Active bans for a page of users at once, so the admin list is not one query per row. */
    List<UserBan> findByUserIdInAndLiftedAtIsNull(Collection<String> userIds);
}
