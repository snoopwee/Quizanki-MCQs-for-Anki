package com.ankiquiz.controller;

import com.ankiquiz.dto.request.SetBannedRequest;
import com.ankiquiz.dto.response.AdminUsersPage;
import com.ankiquiz.service.AdminUserService;
import com.ankiquiz.service.BanService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Admin user management, backed by the Supabase Admin API. Under
 * {@code /api/v1/admin/**}, so it's ROLE_ADMIN-gated in SecurityConfig.
 */
@RestController
@RequestMapping("/api/v1/admin/users")
@SecurityRequirement(name = "bearerAuth")
public class AdminUserController {

    private static final int MAX_PER_PAGE = 200;

    private final AdminUserService adminUserService;
    private final BanService banService;

    public AdminUserController(AdminUserService adminUserService, BanService banService) {
        this.adminUserService = adminUserService;
        this.banService = banService;
    }

    @GetMapping
    @Operation(summary = "List Supabase users (1-based paging), for admin management")
    public AdminUsersPage list(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "50") int perPage
    ) {
        int size = Math.min(Math.max(perPage, 1), MAX_PER_PAGE);
        return adminUserService.listUsers(Math.max(page, 1), size);
    }

    @PutMapping("/{userId}/ban")
    @Operation(summary = "Suspend or restore an account",
            description = "Suspending REQUIRES a reason, and that reason is shown to the person "
                    + "suspended — they can still sign in, and every request is then refused with "
                    + "it. Restoring notifies them, with the optional note as the message. "
                    + "Suspensions are kept as history, so a repeat is visible.")
    public ResponseEntity<Void> setBanned(@AuthenticationPrincipal Jwt jwt,
                                          @PathVariable String userId,
                                          @Valid @RequestBody SetBannedRequest request) {
        if (request.banned()) {
            banService.ban(userId, request.reason(), jwt.getSubject());
        } else {
            banService.lift(userId, jwt.getSubject(), request.reason());
        }
        return ResponseEntity.noContent().build();
    }
}
