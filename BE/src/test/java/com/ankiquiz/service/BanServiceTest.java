package com.ankiquiz.service;

import com.ankiquiz.entity.UserBan;
import com.ankiquiz.exception.ConflictException;
import com.ankiquiz.exception.NotFoundException;
import com.ankiquiz.repository.UserBanRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.web.server.ResponseStatusException;

import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Suspensions. The assertions that matter are about the REASON — a suspension nobody can read is
 * the thing this replaced — and about the ban surviving as history rather than as a flag.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class BanServiceTest {

    private static final String USER = "user-1";
    private static final String ADMIN = "admin-1";

    @Mock private UserBanRepository bans;
    @Mock private NotificationService notifications;

    private final Instant nowInstant = Instant.parse("2026-09-25T09:00:00Z");
    private final Clock clock = Clock.fixed(nowInstant, ZoneOffset.UTC);
    private BanService service;

    @BeforeEach
    void setUp() {
        service = new BanService(bans, notifications, clock);
        when(bans.save(any(UserBan.class))).thenAnswer(i -> i.getArgument(0));
    }

    private UserBan inForce() {
        UserBan ban = new UserBan();
        ban.setUserId(USER);
        ban.setReason("Uploaded copyrighted decks after a warning.");
        ban.setBannedAt(OffsetDateTime.now(clock));
        ban.setBannedBy(ADMIN);
        return ban;
    }

    @Test
    void suspendingRecordsTheReasonAndWhoDidIt() {
        when(bans.findByUserIdAndLiftedAtIsNull(USER)).thenReturn(Optional.empty());

        service.ban(USER, "  Uploaded copyrighted decks.  ", ADMIN);

        ArgumentCaptor<UserBan> saved = ArgumentCaptor.forClass(UserBan.class);
        verify(bans).save(saved.capture());
        assertThat(saved.getValue().getReason()).isEqualTo("Uploaded copyrighted decks.");
        assertThat(saved.getValue().getBannedBy()).isEqualTo(ADMIN);
        assertThat(saved.getValue().isInForce()).isTrue();
    }

    @Test
    void aSuspensionWithNoReasonIsRefused() {
        // The reason is shown to the person suspended — it is the entire point of the ban living
        // in our database instead of at Supabase, so an empty one cannot be allowed through.
        assertThatThrownBy(() -> service.ban(USER, "   ", ADMIN))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Say why");
        verify(bans, never()).save(any());
    }

    @Test
    void suspendingSomebodyAlreadySuspendedIsRefused() {
        when(bans.findByUserIdAndLiftedAtIsNull(USER)).thenReturn(Optional.of(inForce()));

        // Otherwise the standing reason would be overwritten and the first one lost.
        assertThatThrownBy(() -> service.ban(USER, "something else", ADMIN))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("already suspended");
        verify(bans, never()).save(any());
    }

    @Test
    void anAdminCannotSuspendThemselves() {
        when(bans.findByUserIdAndLiftedAtIsNull(ADMIN)).thenReturn(Optional.empty());

        // The one mistake with no way back — the admin panel is behind the same gate.
        assertThatThrownBy(() -> service.ban(ADMIN, "oops", ADMIN))
                .isInstanceOf(ConflictException.class);
        verify(bans, never()).save(any());
    }

    @Test
    void liftingKeepsTheRowAndTellsThem() {
        UserBan ban = inForce();
        when(bans.findByUserIdAndLiftedAtIsNull(USER)).thenReturn(Optional.of(ban));

        service.lift(USER, ADMIN, "  Appealed successfully.  ");

        // History, not a flag: the lifted ban stays, because "suspended twice before" is what an
        // admin needs when deciding about a third time.
        assertThat(ban.getLiftedAt()).isEqualTo(OffsetDateTime.now(clock));
        assertThat(ban.getLiftedBy()).isEqualTo(ADMIN);
        assertThat(ban.getReason()).isEqualTo("Uploaded copyrighted decks after a warning.");
        verify(notifications).accountRestored(USER, "Appealed successfully.");
    }

    @Test
    void liftingSomethingThatIsNotSuspendedIs404() {
        when(bans.findByUserIdAndLiftedAtIsNull(USER)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.lift(USER, ADMIN, null))
                .isInstanceOf(NotFoundException.class);
        verify(notifications, never()).accountRestored(any(), any());
    }

    @Test
    void theAnswerIsCachedBecauseEveryRequestAsks() {
        when(bans.findByUserIdAndLiftedAtIsNull(USER)).thenReturn(Optional.empty());

        service.activeBan(USER);
        service.activeBan(USER);
        service.activeBan(USER);

        // The database is a network hop away and this runs in a filter in front of every route;
        // asking three times for one answer would roughly double the latency of the whole app.
        verify(bans, times(1)).findByUserIdAndLiftedAtIsNull(USER);
    }

    @Test
    void suspendingInvalidatesTheCacheImmediately() {
        when(bans.findByUserIdAndLiftedAtIsNull(USER)).thenReturn(Optional.empty());
        service.activeBan(USER);           // caches "not suspended"

        service.ban(USER, "spam", ADMIN);  // must not leave that cached answer standing
        when(bans.findByUserIdAndLiftedAtIsNull(USER)).thenReturn(Optional.of(inForce()));

        assertThat(service.activeBan(USER)).isPresent();
    }

    @Test
    void liftingInvalidatesTheCacheImmediately() {
        UserBan ban = inForce();
        when(bans.findByUserIdAndLiftedAtIsNull(USER)).thenReturn(Optional.of(ban));
        assertThat(service.activeBan(USER)).isPresent();   // caches "suspended"

        service.lift(USER, ADMIN, null);
        when(bans.findByUserIdAndLiftedAtIsNull(USER)).thenReturn(Optional.empty());

        // A restored account must not stay locked out for up to a minute.
        assertThat(service.activeBan(USER)).isEmpty();
    }

    @Test
    void anAnonymousCallerIsNeverSuspended() {
        assertThat(service.activeBan(null)).isEmpty();
        assertThat(service.activeBan("  ")).isEmpty();
        verify(bans, never()).findByUserIdAndLiftedAtIsNull(any());
    }
}
