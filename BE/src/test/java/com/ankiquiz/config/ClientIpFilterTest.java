package com.ankiquiz.config;

import com.ankiquiz.service.RateLimitKey;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.filter.ForwardedHeaderFilter;

import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The prod filter chain, reproduced.
 *
 * <p>These exist because the obvious fix was wrong. Reading {@code X-Forwarded-For} in the
 * controller looks correct and is dead code in production: {@code ForwardedHeaderFilter} (enabled
 * by {@code server.forward-headers-strategy: framework}) removes the header and rewrites
 * {@code getRemoteAddr()} from its LEFTMOST — client-written — hop first. Only a filter ordered
 * ahead of it can see the truth, so that ordering is pinned here.
 */
class ClientIpFilterTest {

    private static final String FORGED = "1.1.1.1";
    private static final String REAL = "203.0.113.7";

    /** Runs ClientIpFilter → ForwardedHeaderFilter → capture, as configured in prod. */
    private static String keyAfterProdChain(String forwardedFor) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/public/tts");
        request.setRemoteAddr("10.0.0.1"); // the proxy's own socket
        request.addHeader("X-Forwarded-For", forwardedFor);

        AtomicReference<String> seen = new AtomicReference<>();
        MockFilterChain capture = new MockFilterChain() {
            @Override
            public void doFilter(jakarta.servlet.ServletRequest rq, jakarta.servlet.ServletResponse rs) {
                seen.set(RateLimitKey.forRequest((HttpServletRequest) rq));
            }
        };

        // ForwardedHeaderFilter is what the controller would otherwise be left with.
        MockFilterChain forwardedThenCapture = new MockFilterChain() {
            @Override
            public void doFilter(jakarta.servlet.ServletRequest rq, jakarta.servlet.ServletResponse rs)
                    throws java.io.IOException, jakarta.servlet.ServletException {
                new ForwardedHeaderFilter().doFilter(rq, rs, capture);
            }
        };

        new ClientIpFilter().doFilter(request, new MockHttpServletResponse(), forwardedThenCapture);
        return seen.get();
    }

    @Test
    void theProxysHopSurvivesForwardedHeaderFilter() throws Exception {
        // Without ClientIpFilter this would come back as the forged 1.1.1.1.
        assertThat(keyAfterProdChain(FORGED + ", " + REAL)).isEqualTo("ip:" + REAL);
    }

    @Test
    void aSpoofedHopCannotMintFreshBuckets() throws Exception {
        // Two requests, different forged leading hops, same real client: one key, one budget.
        String a = keyAfterProdChain("9.9.9.9, " + REAL);
        String b = keyAfterProdChain("8.8.8.8, " + REAL);

        assertThat(a).isEqualTo(b).isEqualTo("ip:" + REAL);
    }

    @Test
    void aSingleHopIsTakenAsIs() throws Exception {
        assertThat(keyAfterProdChain(REAL)).isEqualTo("ip:" + REAL);
    }

    @Test
    void nearestProxyHopReadsTheLastEntry() {
        assertThat(ClientIpFilter.nearestProxyHop("1.1.1.1, 2.2.2.2, 3.3.3.3")).isEqualTo("3.3.3.3");
        assertThat(ClientIpFilter.nearestProxyHop("  1.1.1.1  ")).isEqualTo("1.1.1.1");
        assertThat(ClientIpFilter.nearestProxyHop("")).isNull();
        assertThat(ClientIpFilter.nearestProxyHop(null)).isNull();
    }

    @Test
    void withNoProxyAtAllItFallsBackToTheSocket() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/public/tts");
        request.setRemoteAddr("198.51.100.4");

        AtomicReference<String> seen = new AtomicReference<>();
        new ClientIpFilter().doFilter(request, new MockHttpServletResponse(), new MockFilterChain() {
            @Override
            public void doFilter(jakarta.servlet.ServletRequest rq, jakarta.servlet.ServletResponse rs) {
                seen.set(RateLimitKey.forRequest((HttpServletRequest) rq));
            }
        });

        assertThat(seen.get()).isEqualTo("ip:198.51.100.4");
    }
}
