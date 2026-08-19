package com.ankiquiz.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Who counts as an admin, from the {@code app.admin.*} allowlists. There is no user
 * table and no self-service — admins are provisioned here, out of band. A caller is
 * an admin if their Supabase user id ({@code jwt.sub}) is on {@code app.admin.user-ids}
 * OR their verified email ({@code jwt.email}) is on {@code app.admin.emails}. Email is
 * the convenient key (you know it up front); the id is marginally more robust (survives
 * an email change) — either works.
 *
 * <p>SecurityConfig uses this to grant {@code ROLE_ADMIN} (which {@code /api/v1/admin/**}
 * requires), and {@code GET /me} uses it to tell the client whether to show the admin
 * area. Both allowlists empty means <em>no</em> admins — admin routes stay locked, so a
 * misconfigured deploy fails closed, not open.
 */
@Component
public class AdminAccess {

    private static final List<GrantedAuthority> ADMIN_AUTHORITIES =
            List.of(new SimpleGrantedAuthority("ROLE_ADMIN"));

    private final Set<String> adminIds;
    private final Set<String> adminEmails;

    public AdminAccess(
            @Value("${app.admin.user-ids:}") String idsCsv,
            @Value("${app.admin.emails:}") String emailsCsv
    ) {
        this.adminIds = parse(idsCsv);
        // Emails compared case-insensitively — store and match lower-cased.
        this.adminEmails = parse(emailsCsv).stream()
                .map(s -> s.toLowerCase())
                .collect(Collectors.toUnmodifiableSet());
    }

    static Set<String> parse(String csv) {
        if (csv == null || csv.isBlank()) {
            return Set.of();
        }
        return Arrays.stream(csv.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toUnmodifiableSet());
    }

    public boolean isAdmin(String userId, String email) {
        return (userId != null && adminIds.contains(userId))
                || (email != null && adminEmails.contains(email.toLowerCase()));
    }

    /** ROLE_ADMIN for an allowlisted caller, otherwise none. */
    public List<GrantedAuthority> authoritiesFor(String userId, String email) {
        return isAdmin(userId, email) ? ADMIN_AUTHORITIES : List.of();
    }
}
