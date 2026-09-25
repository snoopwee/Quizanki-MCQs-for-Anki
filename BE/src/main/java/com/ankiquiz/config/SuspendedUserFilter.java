package com.ankiquiz.config;

import com.ankiquiz.entity.UserBan;
import com.ankiquiz.service.BanService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.lang.NonNull;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.format.DateTimeFormatter;
import java.util.Optional;

/**
 * Refuses every request from a suspended account.
 *
 * <p>This is what makes a suspension mean anything: bans are recorded in our own database (V39)
 * rather than at Supabase, precisely so the suspended person can still authenticate and be TOLD
 * why — and that only works if something then stops them doing anything.
 *
 * <p>{@code GET /me} is the one exception, deliberately. It is how the client learns it is
 * suspended and what the reason was; refusing it too would leave the app with a wall of 403s and
 * nothing to display. It carries no data belonging to anybody else.
 *
 * <p>Fails OPEN on an unexpected error. A filter in front of every route is the worst place for a
 * database hiccup to become an outage, and the cost of briefly missing a ban is far lower than the
 * cost of locking out every user.
 */
/*
 * Deliberately NOT a @Component. Spring Boot auto-registers a Filter bean with the servlet
 * container, so it would run once there AND once in the security chain — and every @WebMvcTest
 * slice would pull it in and demand a BanService. SecurityConfig builds it instead, which is also
 * the only place that knows where in the chain it belongs.
 */
public class SuspendedUserFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(SuspendedUserFilter.class);

    private final BanService bans;

    public SuspendedUserFilter(BanService bans) {
        this.bans = bans;
    }

    @Override
    protected boolean shouldNotFilter(@NonNull HttpServletRequest request) {
        String path = request.getRequestURI();
        return
                // Unauthenticated reads: a suspended account is not why a guest can't browse.
                path.startsWith("/api/v1/public/")
                // How the client finds out it is suspended.
                || path.equals("/api/v1/me")
                || path.startsWith("/actuator/");
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain chain) throws ServletException, IOException {
        Optional<UserBan> ban;
        try {
            ban = bans.activeBan(currentUserId());
        } catch (Exception e) {
            log.error("Suspension check failed; allowing the request through", e);
            chain.doFilter(request, response);
            return;
        }

        if (ban.isEmpty()) {
            chain.doFilter(request, response);
            return;
        }

        // 403 rather than 401: the token is valid and re-authenticating would change nothing.
        // The body carries the reason so any surface can explain itself without a second call.
        response.setStatus(HttpStatus.FORBIDDEN.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write(body(ban.get()));
    }

    private static String currentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getPrincipal() instanceof Jwt jwt ? jwt.getSubject() : null;
    }

    private static String body(UserBan ban) {
        return "{\"status\":403,\"code\":\"account_suspended\",\"message\":"
                + quote(ban.getReason())
                + ",\"bannedAt\":"
                + (ban.getBannedAt() == null
                        ? "null"
                        : quote(ban.getBannedAt().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME)))
                + "}";
    }

    /** Hand-rolled because the reason is admin-written free text and lands inside a JSON string. */
    private static String quote(String value) {
        StringBuilder out = new StringBuilder("\"");
        for (char c : value.toCharArray()) {
            switch (c) {
                case '"' -> out.append("\\\"");
                case '\\' -> out.append("\\\\");
                case '\n' -> out.append("\\n");
                case '\r' -> out.append("\\r");
                case '\t' -> out.append("\\t");
                default -> {
                    if (c < 0x20) {
                        out.append(String.format("\\u%04x", (int) c));
                    } else {
                        out.append(c);
                    }
                }
            }
        }
        return out.append('"').toString();
    }
}
