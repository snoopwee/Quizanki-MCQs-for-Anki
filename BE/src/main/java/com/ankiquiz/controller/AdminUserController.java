package com.ankiquiz.controller;

import com.ankiquiz.dto.request.SetBannedRequest;
import com.ankiquiz.dto.response.AdminUsersPage;
import com.ankiquiz.service.AdminUserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import org.springframework.http.ResponseEntity;
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

    public AdminUserController(AdminUserService adminUserService) {
        this.adminUserService = adminUserService;
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
    @Operation(summary = "Ban or unban a user (disable/enable sign-in)")
    public ResponseEntity<Void> setBanned(@PathVariable String userId, @RequestBody SetBannedRequest request) {
        adminUserService.setBanned(userId, request.banned());
        return ResponseEntity.noContent().build();
    }
}
