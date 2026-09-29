package com.ankiquiz.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.lang.NonNull;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Records the client IP our own proxy reported, before anything can rewrite it.
 *
 * <p><b>Why this exists.</b> In prod {@code server.forward-headers-strategy: framework} registers
 * Spring's {@code ForwardedHeaderFilter}, and that filter does two things a rate limiter must not
 * inherit — verified, not assumed, with {@code X-Forwarded-For: 1.1.1.1, 203.0.113.7}:
 *
 * <pre>
 *   getHeader("X-Forwarded-For")  ->  null        (the header is consumed and removed)
 *   getRemoteAddr()               ->  "1.1.1.1"   (taken from the LEFTMOST hop)
 * </pre>
 *
 * <p>The leftmost hop is whatever the CLIENT sent, so by the time a controller runs, the only IP
 * available is one the caller chose. A flood could mint a fresh value per request and buy an
 * unlimited budget on the most expensive public endpoint. That is right for
 * {@code ForwardedHeaderFilter}'s actual job — reconstructing the externally visible URL — and
 * wrong for deciding who to throttle.
 *
 * <p>So this runs FIRST, reads the <b>rightmost</b> hop (the one our nearest proxy appended from
 * the socket it actually accepted, which a client cannot forge), and stashes it for
 * {@code RateLimitKey}.
 *
 * <p>⚠ Assumes exactly ONE trusted proxy in front of the app (Render today). Put another in front
 * — Cloudflare, say — and the rightmost hop becomes that proxy's own address; this would then need
 * the second-from-right, or the provider's dedicated header ({@code CF-Connecting-IP}).
 */
public class ClientIpFilter extends OncePerRequestFilter {

    /** Request attribute holding the proxy-reported client IP, or absent when there is no proxy. */
    public static final String ATTRIBUTE = ClientIpFilter.class.getName() + ".clientIp";

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain chain) throws ServletException, IOException {
        String nearest = nearestProxyHop(request.getHeader("X-Forwarded-For"));
        if (nearest != null) {
            request.setAttribute(ATTRIBUTE, nearest);
        }
        chain.doFilter(request, response);
    }

    /**
     * The last hop in an {@code X-Forwarded-For} list, or null when there isn't one.
     *
     * <p>Public so {@code RateLimitKey} can reuse it for the dev path, where no proxy has run and
     * the header is still intact — one parser, so the two paths cannot drift.
     */
    public static String nearestProxyHop(String forwardedFor) {
        if (forwardedFor == null || forwardedFor.isBlank()) {
            return null;
        }
        String[] hops = forwardedFor.split(",");
        String nearest = hops[hops.length - 1].trim();
        return nearest.isEmpty() ? null : nearest;
    }
}
