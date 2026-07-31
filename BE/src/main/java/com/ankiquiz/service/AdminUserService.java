package com.ankiquiz.service;

import com.ankiquiz.dto.response.AdminUserResponse;
import com.ankiquiz.dto.response.AdminUsersPage;
import com.fasterxml.jackson.annotation.JsonProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;

import java.net.URI;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/**
 * User management via the Supabase (GoTrue) Admin API. There's no user table here —
 * identity lives in Supabase auth — so listing and banning users means calling
 * {@code /auth/v1/admin/*} with the project's <b>service-role key</b> (the same
 * legacy JWT the avatar/TTS features use; the newer {@code sb_secret_} key is
 * rejected by these endpoints). Reads/mutations are admin-gated at the controller.
 */
@Service
public class AdminUserService {

    private static final Logger log = LoggerFactory.getLogger(AdminUserService.class);
    // A ban far enough out to be "indefinite"; "none" clears it.
    private static final String BAN_FOREVER = "876000h"; // ~100 years

    private final String supabaseUrl;
    private final String serviceKey;
    private final RestClient http = RestClient.create();

    public AdminUserService(
            @Value("${supabase.url:}") String supabaseUrl,
            // Reuse the service-role key the avatar/TTS features already use.
            @Value("${supabase.service-key:${tts.supabase.service-key:}}") String serviceKey
    ) {
        this.supabaseUrl = supabaseUrl;
        this.serviceKey = serviceKey;
    }

    public AdminUsersPage listUsers(int page, int perPage) {
        requireConfigured();
        try {
            GoTrueList body = http.get()
                    .uri(URI.create(supabaseUrl + "/auth/v1/admin/users?page=" + page + "&per_page=" + perPage))
                    .header("apikey", serviceKey)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + serviceKey)
                    .retrieve()
                    .body(GoTrueList.class);

            List<GoTrueUser> users = (body == null || body.users() == null) ? List.of() : body.users();
            List<AdminUserResponse> mapped = users.stream().map(AdminUserService::toResponse).toList();
            // A full page back means there's probably another — good enough for a
            // Prev/Next pager without relying on a total-count header.
            return new AdminUsersPage(mapped, page, perPage, users.size() >= perPage);
        } catch (RestClientResponseException e) {
            log.error("List users failed {}: {}", e.getStatusCode(), snippet(e));
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Couldn't load users from Supabase.");
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            log.error("List users error", e);
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Couldn't reach Supabase.");
        }
    }

    public void setBanned(String userId, boolean banned) {
        requireConfigured();
        try {
            http.put()
                    .uri(URI.create(supabaseUrl + "/auth/v1/admin/users/" + userId))
                    .header("apikey", serviceKey)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + serviceKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("ban_duration", banned ? BAN_FOREVER : "none"))
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientResponseException e) {
            log.error("Set ban failed {}: {}", e.getStatusCode(), snippet(e));
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Couldn't update the user in Supabase.");
        } catch (Exception e) {
            log.error("Set ban error", e);
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Couldn't reach Supabase.");
        }
    }

    // --- mapping (pure, unit-tested) ----------------------------------------

    static AdminUserResponse toResponse(GoTrueUser u) {
        return new AdminUserResponse(
                u.id(), u.email(), displayName(u.userMetadata()),
                u.createdAt(), u.lastSignInAt(), isBanned(u.bannedUntil()));
    }

    // banned_until is a future timestamp while banned; absent/"none"/past = not.
    static boolean isBanned(String bannedUntil) {
        if (bannedUntil == null || bannedUntil.isBlank() || "none".equalsIgnoreCase(bannedUntil)) {
            return false;
        }
        try {
            return OffsetDateTime.parse(bannedUntil).isAfter(OffsetDateTime.now());
        } catch (RuntimeException e) {
            return false;
        }
    }

    // Same preference order as Caller: display_name → full_name → name → null.
    static String displayName(Map<String, Object> metadata) {
        if (metadata == null) {
            return null;
        }
        for (String key : List.of("display_name", "full_name", "name")) {
            Object v = metadata.get(key);
            if (v instanceof String s && !s.isBlank()) {
                return s.trim();
            }
        }
        return null;
    }

    private void requireConfigured() {
        boolean urlOk = supabaseUrl != null && !supabaseUrl.isBlank() && !supabaseUrl.contains("replace-me");
        boolean keyOk = serviceKey != null && !serviceKey.isBlank();
        if (!urlOk || !keyOk) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "User management isn't configured on the server (missing service key).");
        }
    }

    private static String snippet(RestClientResponseException e) {
        String body = e.getResponseBodyAsString();
        if (body == null || body.isBlank()) {
            return "(no body)";
        }
        return body.length() > 200 ? body.substring(0, 200) : body;
    }

    // Minimal shapes of the GoTrue Admin API responses (unknown fields ignored by
    // Spring Boot's Jackson defaults).
    record GoTrueList(List<GoTrueUser> users) {
    }

    record GoTrueUser(
            String id,
            String email,
            @JsonProperty("created_at") String createdAt,
            @JsonProperty("last_sign_in_at") String lastSignInAt,
            @JsonProperty("banned_until") String bannedUntil,
            @JsonProperty("user_metadata") Map<String, Object> userMetadata
    ) {
    }
}
