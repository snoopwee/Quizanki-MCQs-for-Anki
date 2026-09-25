package com.ankiquiz.repository;

import com.ankiquiz.entity.Follow;
import com.ankiquiz.entity.FollowId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface FollowRepository extends JpaRepository<Follow, FollowId> {

    boolean existsByFollowerIdAndAuthorId(String followerId, String authorId);

    long deleteByFollowerIdAndAuthorId(String followerId, String authorId);

    /** The number under an author's name. Served by follows_author_idx. */
    long countByAuthorId(String authorId);

    @Query("select f.authorId from Follow f where f.followerId = :followerId order by f.createdAt desc")
    List<String> authorsFollowedBy(@Param("followerId") String followerId);

    /**
     * Who to notify when this author publishes. Ids only — the fan-out needs nothing else, and
     * pulling whole rows to read one column of each is waste on the one query that scales with
     * an author's popularity.
     */
    @Query("select f.followerId from Follow f where f.authorId = :authorId")
    List<String> followersOf(@Param("authorId") String authorId);
}
