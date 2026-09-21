package com.ankiquiz.repository;

import com.ankiquiz.entity.AiGeneration;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;

@Repository
public interface AiGenerationRepository extends JpaRepository<AiGeneration, Long> {

    /**
     * Attempts that actually reached the provider, for one user on one kind of key.
     *
     * Only {@code ok} and {@code provider_error} count: a request rejected before it left us
     * (bad input, no quota, unusable key) cost the pool nothing, so it must not cost the user
     * one of their daily generations either.
     */
    @Query("""
            select count(g) from AiGeneration g
            where g.userId = :userId
              and g.keyOwner = :keyOwner
              and g.createdAt >= :since
              and g.outcome in ('ok', 'provider_error')
            """)
    long countChargeableForUserSince(@Param("userId") String userId,
                                     @Param("keyOwner") String keyOwner,
                                     @Param("since") OffsetDateTime since);

    /** The same count across every user on the SHARED key — the free tier's real budget. */
    @Query("""
            select count(g) from AiGeneration g
            where g.keyOwner = 'shared'
              and g.createdAt >= :since
              and g.outcome in ('ok', 'provider_error')
            """)
    long countChargeableOnSharedKeySince(@Param("since") OffsetDateTime since);
}
