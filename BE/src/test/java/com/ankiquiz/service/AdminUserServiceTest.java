package com.ankiquiz.service;

import com.ankiquiz.dto.response.AdminUserResponse;
import com.ankiquiz.service.AdminUserService.GoTrueUser;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The GoTrue → DTO mapping is the pure, testable part (the HTTP call itself needs a
 * live Supabase). Ban state and the display-name fallback are the bits worth pinning.
 */
class AdminUserServiceTest {

    @Test
    void toResponse_mapsFields_resolvesDisplayName_andActiveBan() {
        GoTrueUser u = new GoTrueUser(
                "id-1", "alice@example.com",
                "2026-01-01T00:00:00Z", "2026-07-01T00:00:00Z",
                OffsetDateTime.now().plusYears(1).toString(),
                Map.of("full_name", "Alice Anderson"));

        AdminUserResponse r = AdminUserService.toResponse(u);

        assertThat(r.id()).isEqualTo("id-1");
        assertThat(r.email()).isEqualTo("alice@example.com");
        assertThat(r.displayName()).isEqualTo("Alice Anderson");
        assertThat(r.createdAt()).isEqualTo("2026-01-01T00:00:00Z");
        assertThat(r.banned()).isTrue();
    }

    @Test
    void isBanned_trueOnlyForAFutureBannedUntil() {
        assertThat(AdminUserService.isBanned(null)).isFalse();
        assertThat(AdminUserService.isBanned("none")).isFalse();
        assertThat(AdminUserService.isBanned(OffsetDateTime.now().minusDays(1).toString())).isFalse();
        assertThat(AdminUserService.isBanned("not-a-date")).isFalse();
        assertThat(AdminUserService.isBanned(OffsetDateTime.now().plusDays(1).toString())).isTrue();
    }

    @Test
    void displayName_prefersDisplayNameThenFullNameThenName_elseNull() {
        assertThat(AdminUserService.displayName(Map.of("display_name", "D", "full_name", "F"))).isEqualTo("D");
        assertThat(AdminUserService.displayName(Map.of("full_name", "F"))).isEqualTo("F");
        assertThat(AdminUserService.displayName(Map.of("name", "N"))).isEqualTo("N");
        assertThat(AdminUserService.displayName(Map.of())).isNull();
        assertThat(AdminUserService.displayName(null)).isNull();
    }
}
