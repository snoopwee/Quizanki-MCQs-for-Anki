package com.ankiquiz.service;

import com.ankiquiz.entity.Profile;
import com.ankiquiz.repository.ProfileRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * What people are called, so the app can name somebody who has never published anything.
 *
 * <p>Before this existed, a display name lived only on deck rows, which meant a learner who had
 * imported nothing was anonymous to us — no profile page, and no way to render a follower list.
 *
 * <p>The write path is {@link #remember}, called from {@code GET /me}: the access token already
 * carries the name and avatar, so keeping this current costs no extra call to Supabase and heals
 * itself on the next page load after a rename.
 */
@Service
public class ProfileService {

    private final ProfileRepository profiles;
    private final Clock clock;

    public ProfileService(ProfileRepository profiles, Clock clock) {
        this.profiles = profiles;
        this.clock = clock;
    }

    /**
     * Record who this caller is, from a source that is definitely current — the values the profile
     * page just submitted.
     *
     * <p>A no-op when nothing changed: the other entry point runs on every page load, and writing
     * an identical row each time would be a pointless write per request.
     */
    @Transactional
    public void remember(Caller caller) {
        write(caller, null);
    }

    /**
     * Record who this caller is <b>from their access token</b>, which is a snapshot and may be out
     * of date.
     *
     * <p>A JWT is signed at issue and never updated: rename yourself and the token in your hand
     * still carries the old name until it refreshes. So this must never write BACKWARDS over what
     * the profile page already told us — otherwise the next page load after a rename would quietly
     * restore the old name, and it would look intermittent, because a token refresh fixes it.
     *
     * <p>The test is issue time against last write: a token minted before we last learned something
     * cannot be newer than what we know. A missing issue time is treated the same way.
     */
    @Transactional
    public void rememberFromToken(Caller caller, Instant tokenIssuedAt) {
        write(caller, tokenIssuedAt == null ? Instant.EPOCH : tokenIssuedAt);
    }

    /** @param staleIfBefore when set, skip the write if the row is newer than this instant. */
    private void write(Caller caller, Instant staleIfBefore) {
        if (caller == null || caller.id() == null || caller.id().isBlank()) {
            return;
        }
        Profile existing = profiles.findById(caller.id()).orElse(null);
        if (existing != null
                && Objects.equals(existing.getDisplayName(), caller.displayName())
                && Objects.equals(existing.getAvatarUrl(), caller.avatarUrl())) {
            return;
        }
        if (existing != null && staleIfBefore != null
                && existing.getUpdatedAt().toInstant().isAfter(staleIfBefore)) {
            // What we already hold came after this token was issued, so the token is the older
            // story. Leave it; the next refreshed token will carry the same thing and agree.
            return;
        }

        Profile profile = existing == null ? new Profile() : existing;
        profile.setUserId(caller.id());
        profile.setDisplayName(caller.displayName());
        profile.setAvatarUrl(caller.avatarUrl());
        profile.setUpdatedAt(OffsetDateTime.now(clock));
        profiles.save(profile);
    }

    @Transactional(readOnly = true)
    public Optional<Profile> find(String userId) {
        return userId == null || userId.isBlank() ? Optional.empty() : profiles.findById(userId);
    }

    /** Several at once, keyed by user id — for any list of people. */
    @Transactional(readOnly = true)
    public Map<String, Profile> findAll(Collection<String> userIds) {
        if (userIds == null || userIds.isEmpty()) {
            return Map.of();
        }
        return profiles.findByUserIdIn(userIds).stream()
                .collect(Collectors.toMap(Profile::getUserId, Function.identity()));
    }
}
