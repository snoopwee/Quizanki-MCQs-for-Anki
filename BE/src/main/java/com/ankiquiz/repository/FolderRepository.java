package com.ankiquiz.repository;

import com.ankiquiz.entity.Folder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface FolderRepository extends JpaRepository<Folder, UUID> {

    List<Folder> findAllByUserIdOrderByNameAsc(String userId);

    /** Always look a folder up WITH its owner — never by id alone, or one user reads another's. */
    Optional<Folder> findByIdAndUserId(UUID id, String userId);

    boolean existsByUserIdAndName(String userId, String name);
}
