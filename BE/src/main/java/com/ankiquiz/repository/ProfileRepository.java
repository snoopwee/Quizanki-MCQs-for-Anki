package com.ankiquiz.repository;

import com.ankiquiz.entity.Profile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ProfileRepository extends JpaRepository<Profile, String> {

    /** Several people at once — a follower list must not be one query per row. */
    List<Profile> findByUserIdIn(Collection<String> userIds);

    /**
     * Resolve a public handle to a person. Case-insensitive, matching the unique index V35 puts on
     * {@code lower(username)}: "Pyrettt" and "pyrettt" are the same handle.
     */
    Optional<Profile> findByUsernameIgnoreCase(String username);

    boolean existsByUsernameIgnoreCase(String username);
}
