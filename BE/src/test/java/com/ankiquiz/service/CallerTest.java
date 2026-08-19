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
}
