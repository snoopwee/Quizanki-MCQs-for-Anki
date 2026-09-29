package com.ankiquiz.service;

import com.ankiquiz.config.ClientIpFilter;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;

/**
 * Who a rate limit counts against.
 *
 * <p><b>A signed-in user is keyed by their user id; only a true guest is keyed by IP.</b> Two
 * reasons, and the first is the one that bit us:
 *
 * <ol>
 *   <li><b>An IP is not a person.</b> This app is used for live group tests with ten or more people
 *       in one room, sharing one public IP. Keyed by IP they shared a single budget and throttled
 *       each other — the limiter punishing exactly the traffic it should permit. Ten signed-in
 *       people now get ten budgets.
 *   <li><b>A user id cannot be forged; an IP header can.</b> A JWT is signed and verified, so a
 *       per-user key is a real identity. See {@link #clientIp} for what is left for guests.
 * </ol>
 *
 * <p>The public endpoints these guard ({@code /public/tts}, {@code /public/parse-apkg}) permit
 * anonymous access, but Spring Security still authenticates a bearer token when one is present —
 * the browser client attaches it to every request — so a signed-in caller does have a principal
 * here. If that ever stops being true this degrades to IP keying, which is exactly today's
 * behaviour, so the failure mode is "no worse than before" rather than "no limit".
 */
public final class RateLimitKey {

    private RateLimitKey() {
    }

    /** A stable key for the caller: their user id when signed in, otherwise their IP. */
    public static String forRequest(HttpServletRequest http) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof Jwt jwt && jwt.getSubject() != null) {
            // Prefixed so a user id can never collide with an IP string.
            return "u:" + jwt.getSubject();
        }
        return "ip:" + clientIp(http);
    }

    /**
     * The client IP as reported by our own proxy — never one the caller could have chosen.
     *
     * <p>Reads the attribute {@link ClientIpFilter} captured at the very start of the chain. That
     * indirection is not ceremony: in prod {@code ForwardedHeaderFilter} runs before controllers,
     * <b>removes</b> {@code X-Forwarded-For} and sets {@code getRemoteAddr()} from its LEFTMOST —
     * i.e. client-written — hop. Verified, not assumed:
     *
     * <pre>
     *   in:   X-Forwarded-For: 1.1.1.1, 203.0.113.7
     *   out:  getHeader(...) -> null        getRemoteAddr() -> "1.1.1.1"   (the forged one)
     * </pre>
     *
     * <p>So reading the header or the remote address here would key the limiter on a value the
     * attacker supplies, and a fresh fake per request would buy an unlimited budget on the most
     * expensive public endpoint. The filter records the rightmost hop before any of that happens.
     *
     * <p>The header fallback below covers dev, where {@code forward-headers-strategy} is unset and
     * nothing strips the header; {@code getRemoteAddr()} is the last resort with no proxy at all.
     */
    static String clientIp(HttpServletRequest http) {
        Object captured = http.getAttribute(ClientIpFilter.ATTRIBUTE);
        if (captured instanceof String ip && !ip.isBlank()) {
            return ip;
        }
        String nearest = ClientIpFilter.nearestProxyHop(http.getHeader("X-Forwarded-For"));
        return nearest != null ? nearest : http.getRemoteAddr();
    }
}
