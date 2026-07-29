package com.ankiquiz.config;

import org.junit.jupiter.api.Test;
import org.springframework.security.core.GrantedAuthority;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The allowlist is the whole admin gate, so its parsing has to be exact: a stray
 * space or an empty env var must never accidentally admit — or lock out — the
 * wrong person.
 */
class AdminAccessTest {

    @Test
    void recognisesAnAllowlistedSubject_ignoringSurroundingWhitespace() {
        AdminAccess access = new AdminAccess(" user-1 , user-2 ", "");

        assertThat(access.isAdmin("user-1", null)).isTrue();
        assertThat(access.isAdmin("user-2", null)).isTrue();
        assertThat(access.isAdmin("user-3", null)).isFalse();
    }

    @Test
    void recognisesAnAllowlistedEmail_caseInsensitively() {
        AdminAccess access = new AdminAccess("", "adminquizanki@gmail.com");

        // Any user id, matched purely on email — and case doesn't matter.
        assertThat(access.isAdmin("some-uuid", "AdminQuizanki@Gmail.com")).isTrue();
        assertThat(access.isAdmin("some-uuid", "someone@else.com")).isFalse();
    }

    @Test
    void grantsRoleAdminOnlyToAllowlistedCallers() {
        AdminAccess access = new AdminAccess("user-1", "boss@x.com");

        assertThat(access.authoritiesFor("user-1", null))
                .extracting(GrantedAuthority::getAuthority)
                .containsExactly("ROLE_ADMIN");
        assertThat(access.authoritiesFor("nobody", "boss@x.com"))
                .extracting(GrantedAuthority::getAuthority)
                .containsExactly("ROLE_ADMIN");
        assertThat(access.authoritiesFor("user-2", "user-2@x.com")).isEmpty();
    }

    @Test
    void emptyOrBlankAllowlistsMeanNoAdmins_failsClosed() {
        assertThat(AdminAccess.parse("")).isEmpty();
        assertThat(AdminAccess.parse("   ")).isEmpty();
        assertThat(AdminAccess.parse(null)).isEmpty();
        assertThat(new AdminAccess("", "").isAdmin("anyone", "any@one.com")).isFalse();
    }

    @Test
    void ignoresEmptyEntriesFromStrayCommas() {
        assertThat(AdminAccess.parse("user-1,,, ,user-2")).containsExactlyInAnyOrder("user-1", "user-2");
    }

    @Test
    void nullSubjectAndEmailIsNeverAdmin() {
        assertThat(new AdminAccess("user-1", "boss@x.com").isAdmin(null, null)).isFalse();
    }
}
