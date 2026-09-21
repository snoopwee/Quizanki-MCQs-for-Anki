package com.ankiquiz.repository;

import com.ankiquiz.entity.UserAiKey;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface UserAiKeyRepository extends JpaRepository<UserAiKey, String> {
}
