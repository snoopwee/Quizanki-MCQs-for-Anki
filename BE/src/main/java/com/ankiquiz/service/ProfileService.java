package com.ankiquiz.service;

import com.ankiquiz.entity.Profile;
import com.ankiquiz.exception.ConflictException;
import com.ankiquiz.repository.ProfileRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

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
        // Assigned once and then left alone: a handle is somebody's URL, so it must not drift
        // every time they edit their display name.
        if (profile.getUsername() == null || profile.getUsername().isBlank()) {
            assignUsername(profile, caller);
        }
        profiles.save(profile);
    }

    /**
     * Give this person a handle for the first time.
     *
     * <p>What they asked for at sign-up wins when it is legal and still free — and only then is it
     * marked as CHOSEN, because a handle we had to fall back from is not the one they picked. In
     * every other case we generate one and leave the flag false, which is the client's cue to ask
     * them to confirm it once.
     */
    private void assignUsername(Profile profile, Caller caller) {
        String asked = caller.requestedUsername();
        if (asked != null && Usernames.rejection(asked) == null
                && !profiles.existsByUsernameIgnoreCase(asked.trim())) {
            profile.setUsername(asked.trim());
            profile.setUsernameChosen(true);
            return;
        }
        profile.setUsername(generateUsername(caller.id(), caller.displayName()));
    }

    /**
     * A free handle for this person: their name slugged, or an id-derived fallback when the name
     * yields nothing usable (blank, or written in a script that strips to nothing).
     *
     * <p>A taken base gets a suffix derived from the user's own id, so two people who slug to the
     * same base cannot land on the same answer. Two accounts generating the identical base in the
     * same instant could still race the unique index; with the suffix being per-user that window
     * is one statement wide, and the loser's next page load assigns them the suffixed form.
     */
    private String generateUsername(String userId, String displayName) {
        String base = Usernames.slug(displayName);
        if (base.isEmpty()) {
            return Usernames.fallbackFor(userId);
        }
        if (!profiles.existsByUsernameIgnoreCase(base)) {
            return base;
        }
        return base + Usernames.collisionSuffix(userId);
    }

    /**
     * Whether a handle is free to take — asked from the sign-up form, before the account it would
     * belong to exists, which is why it can't be an authenticated call.
     *
     * @return null when it is available, otherwise why it is not.
     */
    @Transactional(readOnly = true)
    public String unavailableBecause(String username) {
        String rejection = Usernames.rejection(username);
        if (rejection != null) {
            return rejection;
        }
        return profiles.existsByUsernameIgnoreCase(username.trim()) ? "That username is taken." : null;
    }

    /** Resolve {@code /user/{username}} to a person. Case-insensitive. */
    @Transactional(readOnly = true)
    public Optional<Profile> findByUsername(String username) {
        return username == null || username.isBlank()
                ? Optional.empty()
                : profiles.findByUsernameIgnoreCase(username.trim());
    }

    /**
     * Change your own handle.
     *
     * <p>Old links break, exactly as they do on every site that allows this — the handle is a
     * label, not the identity, so nothing inside the app breaks with it. The {@code /authors/{id}}
     * URL keeps working regardless, which is why stored notification links use that form.
     *
     * @return the handle as stored, with the capitalisation the user chose.
     */
    @Transactional
    public String changeUsername(String userId, String requested) {
        String rejection = Usernames.rejection(requested);
        if (rejection != null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, rejection);
        }
        String next = requested.trim();

        Profile profile = profiles.findById(userId).orElseThrow(
                () -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Your profile isn't set up yet. Reload the page and try again."));

        // Changing only the capitalisation of your own handle is allowed — the uniqueness check
        // would otherwise report you as already taken by yourself.
        if (next.equalsIgnoreCase(profile.getUsername())) {
            profile.setUsername(next);
            // Confirming the handle we generated is still a choice — it is how the sign-up prompt
            // is answered by everybody who is happy with what they were given.
            profile.setUsernameChosen(true);
            profile.setUpdatedAt(OffsetDateTime.now(clock));
            return next;
        }
        if (profiles.existsByUsernameIgnoreCase(next)) {
            throw new ConflictException("That username is taken.");
        }

        profile.setUsername(next);
        profile.setUsernameChosen(true);
        profile.setUpdatedAt(OffsetDateTime.now(clock));
        return next;
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
