package com.ankiquiz.service;

import com.ankiquiz.entity.Profile;
import com.ankiquiz.exception.ConflictException;
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

import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
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

    // ── handles (V35) ────────────────────────────────────────────────────────

    @Test
    void aNewProfileGetsAHandleSluggedFromTheirName() {
        when(profiles.findById("user-1")).thenReturn(Optional.empty());

        service.remember(new Caller("user-1", "Thanh Nguyen", null));

        assertThat(captureSaved().getUsername()).isEqualTo("thanhnguyen");
    }

    @Test
    void aTakenHandleGetsAPerUserSuffixRatherThanACounter() {
        when(profiles.findById("user-1")).thenReturn(Optional.empty());
        when(profiles.existsByUsernameIgnoreCase("mai")).thenReturn(true);

        service.remember(new Caller("user-1", "Mai", null));
        String taken = captureSaved().getUsername();

        // Derived from the user's own id, so two people who slug to "mai" cannot land on the same
        // answer — a counter would have to be read and written atomically to promise that.
        assertThat(taken).startsWith("mai").isNotEqualTo("mai").hasSize(7);
    }

    @Test
    void somebodyWithNoUsableNameStillGetsAHandle() {
        when(profiles.findById("user-1")).thenReturn(Optional.empty());

        // Blank, and also the case of a name written entirely in a script that slugs to nothing.
        service.remember(new Caller("user-1", "   ", null));

        assertThat(captureSaved().getUsername()).startsWith("user").hasSize(12);
    }

    @Test
    void aHandleIsAssignedOnceAndSurvivesARename() {
        Profile existing = stored("Mai", null);
        existing.setUsername("mai");
        when(profiles.findById("user-1")).thenReturn(Optional.of(existing));

        service.remember(new Caller("user-1", "Mai Tran", null));

        // A handle is somebody's URL. It must not drift every time they edit their display name.
        assertThat(captureSaved().getUsername()).isEqualTo("mai");
    }

    @Test
    void takingSomebodyElsesHandleIs409() {
        Profile existing = stored("Mai", null);
        existing.setUsername("mai");
        when(profiles.findById("user-1")).thenReturn(Optional.of(existing));
        when(profiles.existsByUsernameIgnoreCase("pyrettt")).thenReturn(true);

        assertThatThrownBy(() -> service.changeUsername("user-1", "pyrettt"))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("taken");
    }

    @Test
    void restylingYourOwnHandleIsNotACollisionWithYourself() {
        Profile existing = stored("Mai", null);
        existing.setUsername("mai");
        when(profiles.findById("user-1")).thenReturn(Optional.of(existing));
        when(profiles.existsByUsernameIgnoreCase("MAI")).thenReturn(true);

        assertThat(service.changeUsername("user-1", "MAI")).isEqualTo("MAI");
        assertThat(existing.getUsername()).isEqualTo("MAI");
    }

    @Test
    void aReservedOrMalformedHandleIsRefusedBeforeAnyLookup() {
        assertThatThrownBy(() -> service.changeUsername("user-1", "admin"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("reserved");
        assertThatThrownBy(() -> service.changeUsername("user-1", "no spaces"))
                .isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> service.changeUsername("user-1", "ab"))
                .isInstanceOf(ResponseStatusException.class);

        verify(profiles, never()).existsByUsernameIgnoreCase(any());
    }

    @Test
    void aHandleResolvesToItsPersonCaseInsensitively() {
        Profile mai = stored("Mai", null);
        mai.setUsername("Pyrettt");
        when(profiles.findByUsernameIgnoreCase("pyrettt")).thenReturn(Optional.of(mai));

        assertThat(service.findByUsername("  pyrettt  ")).contains(mai);
        assertThat(service.findByUsername("  ")).isEmpty();
    }

    // ── chosen vs generated (V36) ────────────────────────────────────────────

    @Test
    void aHandleTypedAtSignUpIsHonouredAndCountsAsChosen() {
        when(profiles.findById("user-1")).thenReturn(Optional.empty());

        service.remember(new Caller("user-1", "Thanh Nguyen", null, "pyrettt"));

        Profile saved = captureSaved();
        assertThat(saved.getUsername()).isEqualTo("pyrettt");
        assertThat(saved.isUsernameChosen()).isTrue();
    }

    @Test
    void aRequestedHandleThatIsTakenFallsBackAndIsNotMarkedChosen() {
        when(profiles.findById("user-1")).thenReturn(Optional.empty());
        when(profiles.existsByUsernameIgnoreCase("pyrettt")).thenReturn(true);

        service.remember(new Caller("user-1", "Thanh Nguyen", null, "pyrettt"));

        Profile saved = captureSaved();
        // Not the one they picked, so they get asked — a handle we fell back to isn't theirs.
        assertThat(saved.getUsername()).isEqualTo("thanhnguyen");
        assertThat(saved.isUsernameChosen()).isFalse();
    }

    @Test
    void aRequestedHandleIsNeverTrustedBlindly() {
        when(profiles.findById("user-1")).thenReturn(Optional.empty());

        // It rides in on user_metadata, which the client writes — so it is a REQUEST, checked
        // against the same rules as anything typed in Settings.
        service.remember(new Caller("user-1", "Thanh Nguyen", null, "admin"));

        assertThat(captureSaved().getUsername()).isEqualTo("thanhnguyen");
    }

    @Test
    void confirmingTheGeneratedHandleCountsAsChoosingIt() {
        Profile existing = stored("Thanh", null);
        existing.setUsername("thanhnguyen");
        when(profiles.findById("user-1")).thenReturn(Optional.of(existing));

        service.changeUsername("user-1", "thanhnguyen");

        // The sign-up prompt is pre-filled, so most people answer it by pressing Continue. That
        // has to end the prompting, or they would see it on every page load forever.
        assertThat(existing.isUsernameChosen()).isTrue();
    }

    @Test
    void availabilityAnswersWhyNotJustNo() {
        when(profiles.existsByUsernameIgnoreCase("taken")).thenReturn(true);

        assertThat(service.unavailableBecause("free")).isNull();
        assertThat(service.unavailableBecause("taken")).contains("taken");
        assertThat(service.unavailableBecause("admin")).contains("reserved");
        assertThat(service.unavailableBecause("no spaces")).contains("letters");
    }
}
