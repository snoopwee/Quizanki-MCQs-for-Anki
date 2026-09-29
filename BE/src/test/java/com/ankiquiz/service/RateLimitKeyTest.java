package com.ankiquiz.service;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * What a rate limit counts against. The two cases that matter are a room of people sharing one IP
 * (they must NOT share a budget) and a client forging {@code X-Forwarded-For} (it must not buy one).
 */
class RateLimitKeyTest {

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    private static void signedInAs(String userId) {
        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "ES256")
                .subject(userId)
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
        SecurityContextHolder.getContext()
                .setAuthentication(new TestingAuthenticationToken(jwt, null, "ROLE_USER"));
    }

    @Test
    void twoSignedInPeopleOnTheSameIpGetSeparateBudgets() {
        // The live-group-test case: ten people in one room behind one router. Keyed by IP they
        // throttled each other, which is the limiter blocking exactly the traffic it should allow.
        MockHttpServletRequest sharedWifi = new MockHttpServletRequest();
        sharedWifi.addHeader("X-Forwarded-For", "203.0.113.7");

        signedInAs("user-a");
        String a = RateLimitKey.forRequest(sharedWifi);
        SecurityContextHolder.clearContext();

        signedInAs("user-b");
        String b = RateLimitKey.forRequest(sharedWifi);

        assertThat(a).isNotEqualTo(b);
        assertThat(a).isEqualTo("u:user-a");
        assertThat(b).isEqualTo("u:user-b");
    }

    @Test
    void aGuestFallsBackToTheirIp() {
        MockHttpServletRequest http = new MockHttpServletRequest();
        http.addHeader("X-Forwarded-For", "203.0.113.7");

        assertThat(RateLimitKey.forRequest(http)).isEqualTo("ip:203.0.113.7");
    }

    @Test
    void aUserKeyCannotCollideWithAnIpKey() {
        // Prefixes exist so a (hypothetical) user id that looks like an IP stays distinct.
        MockHttpServletRequest http = new MockHttpServletRequest();
        http.addHeader("X-Forwarded-For", "203.0.113.7");
        String guest = RateLimitKey.forRequest(http);

        signedInAs("203.0.113.7");
        assertThat(RateLimitKey.forRequest(http)).isNotEqualTo(guest);
    }

    @Test
    void aForgedForwardedForHopIsIgnoredInFavourOfTheProxysOwn() {
        // The client wrote "1.1.1.1"; our proxy appended the address it actually accepted.
        // Taking the LEFTMOST hop (the old behaviour) let anyone mint a fresh budget per request.
        MockHttpServletRequest http = new MockHttpServletRequest();
        http.addHeader("X-Forwarded-For", "1.1.1.1, 203.0.113.7");

        assertThat(RateLimitKey.forRequest(http)).isEqualTo("ip:203.0.113.7");
    }

    @Test
    void aFloodOfForgedHopsAllResolveToTheSameKey() {
        // The point of the fix: spoofing no longer buys extra buckets.
        MockHttpServletRequest first = new MockHttpServletRequest();
        first.addHeader("X-Forwarded-For", "9.9.9.9, 203.0.113.7");
        MockHttpServletRequest second = new MockHttpServletRequest();
        second.addHeader("X-Forwarded-For", "8.8.8.8, 203.0.113.7");

        assertThat(RateLimitKey.forRequest(first)).isEqualTo(RateLimitKey.forRequest(second));
    }

    @Test
    void withNoForwardedHeaderItUsesTheSocketAddress() {
        MockHttpServletRequest http = new MockHttpServletRequest();
        http.setRemoteAddr("198.51.100.4");

        assertThat(RateLimitKey.forRequest(http)).isEqualTo("ip:198.51.100.4");
    }
}
