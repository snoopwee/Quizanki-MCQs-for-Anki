package com.ankiquiz.service;

import com.ankiquiz.entity.Profile;
import com.ankiquiz.repository.ProfileRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Profiles. This runs on every page load, so the assertions that matter are about how rarely it
 * writes — and about it being the app's answer to "who is this person" for somebody with no decks.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ProfileServiceTest {

    @Mock private ProfileRepository profiles;

    private final Instant nowInstant = Instant.parse("2026-09-23T12:00:00Z");
    private final Clock clock = Clock.fixed(nowInstant, ZoneOffset.UTC);
    private ProfileService service;

    @BeforeEach
    void setUp() {
        service = new ProfileService(profiles, clock);
    }

    private Profile stored(String name, String avatar) {
        Profile p = new Profile();
        p.setUserId("user-1");
        p.setDisplayName(name);
        p.setAvatarUrl(avatar);
        p.setUpdatedAt(OffsetDateTime.parse("2026-09-01T00:00:00Z"));
        return p;
    }

    private Profile captureSaved() {
        ArgumentCaptor<Profile> saved = ArgumentCaptor.forClass(Profile.class);
        verify(profiles).save(saved.capture());
        return saved.getValue();
    }

    /** A token minted after anything we know — the normal case. */
    private Instant freshToken() {
        return nowInstant;
    }

    @Test
    void aFirstSightOfSomebodyWritesTheirProfile() {
        when(profiles.findById("user-1")).thenReturn(Optional.empty());

        service.rememberFromToken(new Caller("user-1", "Mai", "mai.webp"), freshToken());

        Profile saved = captureSaved();
        assertThat(saved.getUserId()).isEqualTo("user-1");
        assertThat(saved.getDisplayName()).isEqualTo("Mai");
        assertThat(saved.getAvatarUrl()).isEqualTo("mai.webp");
        assertThat(saved.getUpdatedAt()).isEqualTo(OffsetDateTime.ofInstant(nowInstant, ZoneOffset.UTC));
    }

    @Test
    void anUnchangedProfileIsNotRewrittenOnEveryPageLoad() {
        when(profiles.findById("user-1")).thenReturn(Optional.of(stored("Mai", "mai.webp")));

        service.rememberFromToken(new Caller("user-1", "Mai", "mai.webp"), freshToken());

        // This runs on every single request to /me; writing an identical row each time would be a
        // pointless write per page load.
        verify(profiles, never()).save(any());
    }

    @Test
    void arenameIsPickedUpFromTheTokenWithNoExtraCallToSupabase() {
        when(profiles.findById("user-1")).thenReturn(Optional.of(stored("Mai", "mai.webp")));

        service.rememberFromToken(new Caller("user-1", "Mai Nguyen", "mai.webp"), freshToken());

        assertThat(captureSaved().getDisplayName()).isEqualTo("Mai Nguyen");
    }

    @Test
    void losingAnAvatarIsAChangeToo() {
        when(profiles.findById("user-1")).thenReturn(Optional.of(stored("Mai", "mai.webp")));

        service.rememberFromToken(new Caller("user-1", "Mai", null), freshToken());

        assertThat(captureSaved().getAvatarUrl()).isNull();
    }

    @Test
    void nothingIsWrittenForACallerWithNoId() {
        service.remember(null);
        service.remember(new Caller(null, "Mai", null));
        service.remember(new Caller("  ", "Mai", null));

        verify(profiles, never()).save(any());
    }

    @Test
    void severalPeopleAreLookedUpInOneQuery() {
        when(profiles.findByUserIdIn(List.of("user-1", "user-2")))
                .thenReturn(List.of(stored("Mai", null)));

        Map<String, Profile> found = service.findAll(List.of("user-1", "user-2"));

        // A follower list must not be one query per row.
        assertThat(found).containsOnlyKeys("user-1");
        verify(profiles).findByUserIdIn(List.of("user-1", "user-2"));
    }

    @Test
    void askingAboutNobodyIsNotAQuery() {
        assertThat(service.findAll(List.of())).isEmpty();
        assertThat(service.findAll(null)).isEmpty();
        assertThat(service.find(null)).isEmpty();
        assertThat(service.find("  ")).isEmpty();

        verify(profiles, never()).findByUserIdIn(any());
        verify(profiles, never()).findById(any());
    }

    // ── a token is a snapshot, and must never write backwards ────────────────

    @Test
    void aStaleTokenCannotUndoARenameTheProfilePageJustMade() {
        // The profile page wrote "Mai Nguyen" a moment ago. The token in the browser was issued
        // before that and still says "Mai" — it is the older story.
        Profile justRenamed = stored("Mai Nguyen", "mai.webp");
        justRenamed.setUpdatedAt(OffsetDateTime.ofInstant(nowInstant, ZoneOffset.UTC));
        when(profiles.findById("user-1")).thenReturn(Optional.of(justRenamed));

        service.rememberFromToken(new Caller("user-1", "Mai", "mai.webp"), nowInstant.minusSeconds(600));

        // Without this guard the very next page load would restore the old name, and it would look
        // intermittent, because a token refresh later fixes it.
        verify(profiles, never()).save(any());
    }

    @Test
    void aTokenWithNoIssueTimeIsTreatedAsTheOlderStory() {
        Profile justRenamed = stored("Mai Nguyen", null);
        justRenamed.setUpdatedAt(OffsetDateTime.ofInstant(nowInstant, ZoneOffset.UTC));
        when(profiles.findById("user-1")).thenReturn(Optional.of(justRenamed));

        service.rememberFromToken(new Caller("user-1", "Mai", null), null);

        verify(profiles, never()).save(any());
    }

    @Test
    void aRefreshedTokenIsStillAllowedToTeachUsSomethingNew() {
        // Same situation, but the token was minted AFTER our last write — so it carries newer
        // information (a rename made elsewhere, say directly in Supabase).
        Profile older = stored("Mai", null);
        older.setUpdatedAt(OffsetDateTime.ofInstant(nowInstant.minusSeconds(3600), ZoneOffset.UTC));
        when(profiles.findById("user-1")).thenReturn(Optional.of(older));

        service.rememberFromToken(new Caller("user-1", "Mai Nguyen", null), nowInstant);

        assertThat(captureSaved().getDisplayName()).isEqualTo("Mai Nguyen");
    }

    @Test
    void theProfilePagesOwnWriteIsNeverHeldBack() {
        // remember() carries values the user just typed, so it is current by construction and the
        // staleness test does not apply to it.
        Profile justRenamed = stored("Mai Nguyen", null);
        justRenamed.setUpdatedAt(OffsetDateTime.ofInstant(nowInstant, ZoneOffset.UTC));
        when(profiles.findById("user-1")).thenReturn(Optional.of(justRenamed));

        service.remember(new Caller("user-1", "Mai Thi Nguyen", null));

        assertThat(captureSaved().getDisplayName()).isEqualTo("Mai Thi Nguyen");
    }
}
