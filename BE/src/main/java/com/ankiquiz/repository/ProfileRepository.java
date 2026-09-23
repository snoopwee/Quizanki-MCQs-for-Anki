package com.ankiquiz.repository;

import com.ankiquiz.entity.Profile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface ProfileRepository extends JpaRepository<Profile, String> {

    /** Several people at once — a follower list must not be one query per row. */
    List<Profile> findByUserIdIn(Collection<String> userIds);
}
