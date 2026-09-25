package com.ankiquiz.service;

import com.ankiquiz.dto.response.NotificationSettingResponse;
import com.ankiquiz.entity.NotificationMute;
import com.ankiquiz.exception.NotFoundException;
import com.ankiquiz.repository.NotificationMuteRepository;
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
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Notification preferences. Stored as a mute list, so the assertions are mostly about the default
 * being "send" and about which kinds are not up for negotiation.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class NotificationSettingsServiceTest {

    private static final String USER = "user-1";

    @Mock private NotificationMuteRepository mutes;

    private final Instant nowInstant = Instant.parse("2026-09-23T14:00:00Z");
    private final Clock clock = Clock.fixed(nowInstant, ZoneOffset.UTC);
    private NotificationSettingsService service;

    @BeforeEach
    void setUp() {
        service = new NotificationSettingsService(mutes, clock);
    }

    @Test
    void theSettingsListOffersOnlyTheKindsAPersonMayTurnOff() {
        when(mutes.kindsMutedBy(USER)).thenReturn(List.of());

        List<String> offered = service.settings(USER).stream()
                .map(NotificationSettingResponse::kind).toList();

        assertThat(offered).contains("new_follower", "author_published", "deck_shared", "deck_reviewed");
        // An announcement is operational and the one channel the team has; the outcome of a report
        // is something the person asked for. Neither is a choice.
        assertThat(offered).doesNotContain("announcement", "report_reviewed");
    }

    @Test
    void havingNeverOpenedSettingsMeansEverythingIsOn() {
        when(mutes.kindsMutedBy(USER)).thenReturn(List.of());

        assertThat(service.settings(USER)).allSatisfy(s -> assertThat(s.muted()).isFalse());
    }

    @Test
    void aMutedKindReadsBackAsMuted() {
        when(mutes.kindsMutedBy(USER)).thenReturn(List.of("new_follower"));

        assertThat(service.settings(USER))
                .filteredOn(s -> s.kind().equals("new_follower"))
                .allSatisfy(s -> assertThat(s.muted()).isTrue());
    }

    @Test
    void mutingWritesOneRowAndMutingAgainWritesNothing() {
        when(mutes.existsByUserIdAndKind(USER, "new_follower")).thenReturn(false);
        service.setMuted(USER, "new_follower", true);

        ArgumentCaptor<NotificationMute> saved = ArgumentCaptor.forClass(NotificationMute.class);
        verify(mutes).save(saved.capture());
        assertThat(saved.getValue().getUserId()).isEqualTo(USER);
        assertThat(saved.getValue().getKind()).isEqualTo("new_follower");
        assertThat(saved.getValue().getMutedAt())
                .isEqualTo(OffsetDateTime.ofInstant(nowInstant, ZoneOffset.UTC));

        org.mockito.Mockito.clearInvocations(mutes);
        when(mutes.existsByUserIdAndKind(USER, "new_follower")).thenReturn(true);
        service.setMuted(USER, "new_follower", true);
        verify(mutes, never()).save(any());
    }

    @Test
    void unmutingRemovesTheRowAndUnmutingNothingIsFine() {
        service.setMuted(USER, "new_follower", false);

        verify(mutes).deleteByUserIdAndKind(USER, "new_follower");
        verify(mutes, never()).save(any());
    }

    @Test
    void aKindThatCannotBeSwitchedOffIsRefusedPlainly() {
        // Better a refusal than a switch that silently does nothing.
        assertThatThrownBy(() -> service.setMuted(USER, "announcement", true))
                .isInstanceOf(ResponseStatusException.class);
        assertThatThrownBy(() -> service.setMuted(USER, "report_reviewed", true))
                .isInstanceOf(ResponseStatusException.class);
        verify(mutes, never()).save(any());
    }

    @Test
    void aKindThisAppDoesNotHaveIs404() {
        assertThatThrownBy(() -> service.setMuted(USER, "deck_admired", true))
                .isInstanceOf(NotFoundException.class);
        verify(mutes, never()).save(any());
    }
}
