package com.ankiquiz.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Admin-only endpoints. Everything under {@code /api/v1/admin/**} is gated to
 * ROLE_ADMIN in SecurityConfig (granted only to the app.admin.user-ids allowlist),
 * so a non-admin hitting any of these gets 403 regardless of the frontend guard.
 *
 * <p>Feature endpoints (deck moderation, stats, users, reports, site config) land
 * here in later phases; for now this just confirms the gate works.
 */
@RestController
@RequestMapping("/api/v1/admin")
@SecurityRequirement(name = "bearerAuth")
public class AdminController {

    @GetMapping("/whoami")
    @Operation(summary = "Confirm the caller is recognised as an admin (200 for admins, 403 otherwise)")
    public Map<String, Object> whoami(@AuthenticationPrincipal Jwt jwt) {
        return Map.of("userId", jwt.getSubject(), "admin", true);
    }
}
