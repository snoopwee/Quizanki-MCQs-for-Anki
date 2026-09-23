package com.ankiquiz.service;

import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Deck credit lines are built from whatever the Supabase token happens to carry,
 * and different sign-in routes populate different claims — so each fallback here
 * covers a real case, not a hypothetical one.
 */
class CallerTest {

    private static Jwt.Builder token() {
        return Jwt.withTokenValue("t").header("alg", "ES256").subject("user-1");
    }

    @Test
    void prefersTheProfilePagesDisplayName() {
        Caller caller = Caller.from(token()
                .claim("user_metadata", Map.of("display_name", "Alice", "full_name", "Alice Anderson"))
                .claim("email", "alice@example.com")
                .build());

        assertThat(caller.id()).isEqualTo("user-1");
        assertThat(caller.displayName()).isEqualTo("Alice");
    }

    @Test
    void fallsBackToFullName_whichIsWhatOAuthSignInPopulates() {
        Caller caller = Caller.from(token()
                .claim("user_metadata", Map.of("full_name", "Alice Anderson"))
                .build());

        assertThat(caller.displayName()).isEqualTo("Alice Anderson");
    }

    @Test
    void fallsBackToTheEmailLocalPart() {
        Caller caller = Caller.from(token().claim("email", "alice@example.com").build());

        assertThat(caller.displayName()).isEqualTo("alice");
    }

    @Test
    void treatsABlankNameAsAbsent() {
        Caller caller = Caller.from(token()
                .claim("user_metadata", Map.of("display_name", "   "))
                .claim("email", "alice@example.com")
                .build());

        assertThat(caller.displayName()).isEqualTo("alice");
    }

    @Test
    void fallsBackToAnonymous_whenTheTokenCarriesNoNameAtAll() {
        assertThat(Caller.from(token().build()).displayName()).isEqualTo(Caller.ANONYMOUS);
    }

    @Test
    void survivesAUserMetadataClaimThatIsntAnObject() {
        Caller caller = Caller.from(token()
                .claim("user_metadata", "not-an-object")
                .claim("email", "alice@example.com")
                .build());

        assertThat(caller.displayName()).isEqualTo("alice");
    }

    @Test
    void prefersTheUploadedAvatarOverAnyOAuthDefault() {
        Caller caller = Caller.from(token()
                .claim("user_metadata", Map.of(
                        "custom_avatar_url", "https://cdn/uploaded.png",
                        "avatar_url", "https://google/default.png"))
                .build());

        assertThat(caller.avatarUrl()).isEqualTo("https://cdn/uploaded.png");
    }

    @Test
    void fallsBackToTheOAuthAvatar_whenNoUploadExists() {
        Caller caller = Caller.from(token()
                .claim("user_metadata", Map.of("picture", "https://google/pic.png"))
                .build());

        assertThat(caller.avatarUrl()).isEqualTo("https://google/pic.png");
    }

    @Test
    void hasNoAvatar_whenTheTokenCarriesNone() {
        assertThat(Caller.from(token().build()).avatarUrl()).isNull();
    }

    // ── withOverrides: what the profile page just typed beats what the token says ──

    @Test
    void withOverrides_prefersWhatWasJustTyped_overAStaleToken() {
        // A rename reaches Supabase before the access token carrying it does, so right after
        // updateUser the JWT still says the old name.
        Caller resolved = new Caller("user-1", "stale-jwt-name", null)
                .withOverrides("  Alice Renamed  ", "  https://cdn/a.png  ");

        assertThat(resolved.id()).isEqualTo("user-1");
        assertThat(resolved.displayName()).isEqualTo("Alice Renamed");
        assertThat(resolved.avatarUrl()).isEqualTo("https://cdn/a.png");
    }

    @Test
    void withOverrides_fallsBackToTheTokenWhenNothingWasTyped() {
        // The "removed my custom photo, keep my OAuth one" case: by now the caller has cleared the
        // custom key and refreshed, so the token's avatar is the effective one.
        Caller resolved = new Caller("user-1", "alice", "https://oauth/pic.png")
                .withOverrides("   ", "  ");

        assertThat(resolved.displayName()).isEqualTo("alice");
        assertThat(resolved.avatarUrl()).isEqualTo("https://oauth/pic.png");
    }

    @Test
    void withOverrides_leavesNoAvatarAsNullRatherThanBlank() {
        Caller resolved = new Caller("user-1", "alice", null).withOverrides(null, null);

        assertThat(resolved.displayName()).isEqualTo("alice");
        assertThat(resolved.avatarUrl()).isNull();
    }
}
