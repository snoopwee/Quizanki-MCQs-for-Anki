package com.ankiquiz.service;

import com.ankiquiz.dto.response.AdminUserResponse;
import com.ankiquiz.dto.response.AdminUsersPage;
import com.ankiquiz.service.AdminUserService.GoTrueUser;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
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

    // ── walking every user, for an admin broadcast ───────────────────────────
    // The HTTP call still needs a live Supabase, but the paging decisions don't: collectUserIds
    // takes a page-fetcher, so the stopping conditions are testable.

    private static AdminUserResponse user(String id) {
        return new AdminUserResponse(id, id + "@example.com", null, null, null, false);
    }

    @Test
    void collectUserIds_pagesUntilTheApiSaysThereIsNoMore() {
        AdminUsersPage first = new AdminUsersPage(List.of(user("a"), user("b")), 1, 2, true);
        AdminUsersPage second = new AdminUsersPage(List.of(user("c")), 2, 2, false);

        List<Integer> requested = new ArrayList<>();
        List<String> ids = AdminUserService.collectUserIds(page -> {
            requested.add(page);
            return page == 1 ? first : second;
        }, 100, 50);

        assertThat(ids).containsExactly("a", "b", "c");
        // 1-based, and it stopped rather than asking for a third page.
        assertThat(requested).containsExactly(1, 2);
    }

    @Test
    void collectUserIds_stopsAtTheCapMidPage() {
        AdminUsersPage page = new AdminUsersPage(List.of(user("a"), user("b"), user("c")), 1, 3, true);

        assertThat(AdminUserService.collectUserIds(p -> page, 2, 50)).containsExactly("a", "b");
        assertThat(AdminUserService.collectUserIds(p -> page, 0, 50)).isEmpty();
        assertThat(AdminUserService.collectUserIds(p -> page, -5, 50)).isEmpty();
    }

    @Test
    void collectUserIds_cannotLoopForeverOnAnApiThatAlwaysSaysHasMore() {
        // Every page claims there is another. The page ceiling is what ends it.
        AdminUsersPage endless = new AdminUsersPage(List.of(user("a")), 1, 1, true);

        List<String> ids = AdminUserService.collectUserIds(p -> endless, 1000, 3);

        assertThat(ids).hasSize(3);
    }

    @Test
    void collectUserIds_skipsBlankIdsAndSurvivesAMissingPage() {
        AdminUsersPage withBlanks = new AdminUsersPage(
                List.of(user("a"), new AdminUserResponse(null, null, null, null, null, false),
                        new AdminUserResponse("  ", null, null, null, null, false), user("d")),
                1, 4, false);

        assertThat(AdminUserService.collectUserIds(p -> withBlanks, 100, 50)).containsExactly("a", "d");
        assertThat(AdminUserService.collectUserIds(p -> null, 100, 50)).isEmpty();
    }
}
