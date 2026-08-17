package com.ankiquiz.repository;

import com.ankiquiz.entity.MediaObject;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * Registry of content-addressed media blobs (keyed by SHA-256 hex). Used to check
 * whether a blob is already stored (dedup) and to sweep orphans.
 *
 * <p><b>Orphan detection.</b> A note references an object by a public URL that ends
 * in the object's hash (…/public/&lt;bucket&gt;/&lt;hash&gt;), so we build the set of
 * referenced hashes once — the last path segment of each of the four note media
 * columns — and anti-join it against the registry. That's one sequential pass over
 * each table (O(notes + objects)), not a per-object substring scan. The
 * {@code cutoff} is a grace window: objects newer than it are never reaped, so a
 * clip uploaded moments before its note is saved (mid-import) can't be deleted out
 * from under the save. Postgres-only (native SQL), consistent with the stats
 * queries; the test suite runs no DB so this is exercised at runtime only.
 */
public interface MediaObjectRepository extends JpaRepository<MediaObject, String> {

    String REFERENCED_CTE = """
        with referenced as (
          select substring(front_image_url from '[^/]+$') as h from notes where front_image_url is not null
          union select substring(back_image_url from '[^/]+$') from notes where back_image_url is not null
          union select substring(front_audio_url from '[^/]+$') from notes where front_audio_url is not null
          union select substring(back_audio_url from '[^/]+$') from notes where back_audio_url is not null
        )
        """;

    /** How many objects are reclaimable (orphaned + past the grace window). */
    @Query(value = REFERENCED_CTE + """
        select count(*) from media_objects m
        left join referenced r on r.h = m.hash
        where m.created_at < :cutoff and r.h is null
        """, nativeQuery = true)
    long countOrphans(@Param("cutoff") OffsetDateTime cutoff);

    /** Total bytes those reclaimable objects occupy. */
    @Query(value = REFERENCED_CTE + """
        select coalesce(sum(m.byte_size), 0) from media_objects m
        left join referenced r on r.h = m.hash
        where m.created_at < :cutoff and r.h is null
        """, nativeQuery = true)
    long sumOrphanBytes(@Param("cutoff") OffsetDateTime cutoff);

    /** Up to {@code limit} reclaimable objects to delete this run. */
    @Query(value = REFERENCED_CTE + """
        select m.* from media_objects m
        left join referenced r on r.h = m.hash
        where m.created_at < :cutoff and r.h is null
        limit :limit
        """, nativeQuery = true)
    List<MediaObject> findOrphanBatch(@Param("cutoff") OffsetDateTime cutoff, @Param("limit") int limit);
}
