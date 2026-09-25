package com.ankiquiz.service.ai;

import com.ankiquiz.exception.AiUnavailableException;
import com.ankiquiz.exception.RateLimitExceededException;
import com.ankiquiz.repository.AiGenerationRepository;
import com.ankiquiz.service.ai.AiQuotaService.AiAccess;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

/**
 * Who may generate, on whose key. The case that matters most is the shared free-tier key: it is
 * ONE pool for every user, so a per-user cap and a global ceiling both have to hold.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AiQuotaServiceTest {

    private static final String USER = "user-1";
    private static final String SHARED_KEY = "shared-pool-key";
    private static final ZoneId SAIGON = ZoneId.of("Asia/Ho_Chi_Minh");

    @Mock private AiKeyService keyService;
    @Mock private AiGenerationRepository generations;

    private final Clock clock = Clock.fixed(Instant.parse("2026-09-21T09:00:00Z"), ZoneOffset.UTC);

    private AiQuotaService service(boolean enabled, String sharedKey) {
        return new AiQuotaService(keyService, generations, clock, enabled, sharedKey,
                5, 200, 100, "America/Los_Angeles");
    }

    private void userHasOwnKey(String key) {
        when(keyService.resolveKey(USER)).thenReturn(Optional.ofNullable(key));
    }

    @Test
    void switchedOffMeansNobodyGenerates() {
        userHasOwnKey("their-own-key");

        assertThatThrownBy(() -> service(false, SHARED_KEY).authorize(USER, SAIGON))
                .isInstanceOf(AiUnavailableException.class)
                .hasMessageContaining("switched off");
    }

    @Test
    void withNoKeyAnywhereItTellsThemToBringOne() {
        userHasOwnKey(null);

        assertThatThrownBy(() -> service(true, "").authorize(USER, SAIGON))
                .isInstanceOf(AiUnavailableException.class)
                .hasMessageContaining("your own API key");
    }

    @Test
    void ownKeyIsUsedAndReportsWhatIsLeft() {
        userHasOwnKey("their-own-key");
        when(generations.countChargeableForUserSince(eq(USER), eq(AiAccess.USER), any())).thenReturn(4L);

        AiAccess access = service(true, SHARED_KEY).authorize(USER, SAIGON);

        assertThat(access.keyOwner()).isEqualTo(AiAccess.USER);
        assertThat(access.apiKey()).isEqualTo("their-own-key");
        assertThat(access.remainingToday()).isEqualTo(96);
        assertThat(access.isShared()).isFalse();
    }

    @Test
    void ownKeyStillHasAnAbuseBackstop() {
        userHasOwnKey("their-own-key");
        when(generations.countChargeableForUserSince(eq(USER), eq(AiAccess.USER), any())).thenReturn(100L);

        assertThatThrownBy(() -> service(true, SHARED_KEY).authorize(USER, SAIGON))
                .isInstanceOf(RateLimitExceededException.class);
    }

    @Test
    void theSharedKeyIsUsedWhenTheUserHasNoneOfTheirOwn() {
        userHasOwnKey(null);
        when(generations.countChargeableForUserSince(eq(USER), eq(AiAccess.SHARED), any())).thenReturn(2L);
        when(generations.countChargeableOnSharedKeySince(any())).thenReturn(20L);

        AiAccess access = service(true, SHARED_KEY).authorize(USER, SAIGON);

        assertThat(access.isShared()).isTrue();
        assertThat(access.apiKey()).isEqualTo(SHARED_KEY);
        assertThat(access.remainingToday()).isEqualTo(3);
    }

    @Test
    void onePersonCannotTakeMoreThanTheirDailyShare() {
        userHasOwnKey(null);
        when(generations.countChargeableForUserSince(eq(USER), eq(AiAccess.SHARED), any())).thenReturn(5L);

        assertThatThrownBy(() -> service(true, SHARED_KEY).authorize(USER, SAIGON))
                .isInstanceOf(RateLimitExceededException.class)
                .hasMessageContaining("your own API key");
    }

    @Test
    void whenThePoolIsSpentEveryoneWaits_evenAUserWithQuotaLeft() {
        userHasOwnKey(null);
        when(generations.countChargeableForUserSince(eq(USER), eq(AiAccess.SHARED), any())).thenReturn(0L);
        when(generations.countChargeableOnSharedKeySince(any())).thenReturn(200L);

        assertThatThrownBy(() -> service(true, SHARED_KEY).authorize(USER, SAIGON))
                .isInstanceOf(RateLimitExceededException.class)
                .hasMessageContaining("everyone");
    }

    @Test
    void theUsersDayIsTheirOwn_thePoolsDayIsTheProvidersReset() {
        userHasOwnKey(null);
        when(generations.countChargeableForUserSince(eq(USER), eq(AiAccess.SHARED), any())).thenReturn(0L);
        when(generations.countChargeableOnSharedKeySince(any())).thenReturn(0L);

        service(true, SHARED_KEY).authorize(USER, SAIGON);

        // 2026-09-21T09:00Z is 16:00 in Saigon (same calendar day) but still 02:00 Pacific, so the
        // two windows start at different instants — the pool's follows the provider's reset.
        var userSince = org.mockito.ArgumentCaptor.forClass(java.time.OffsetDateTime.class);
        var poolSince = org.mockito.ArgumentCaptor.forClass(java.time.OffsetDateTime.class);
        org.mockito.Mockito.verify(generations)
                .countChargeableForUserSince(eq(USER), eq(AiAccess.SHARED), userSince.capture());
        org.mockito.Mockito.verify(generations).countChargeableOnSharedKeySince(poolSince.capture());

        assertThat(userSince.getValue().toInstant()).isEqualTo(Instant.parse("2026-09-20T17:00:00Z"));
        assertThat(poolSince.getValue().toInstant()).isEqualTo(Instant.parse("2026-09-21T07:00:00Z"));
    }
}
