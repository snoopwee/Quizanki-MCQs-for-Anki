package com.ankiquiz.controller;

import com.ankiquiz.dto.request.AnnouncementRequest;
import com.ankiquiz.dto.response.AnnouncementResultResponse;
import com.ankiquiz.dto.response.AudienceResponse;
import com.ankiquiz.service.AdminUserService;
import com.ankiquiz.service.NotificationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Admin broadcasts. Under {@code /api/v1/admin/**}, so SecurityConfig gates it on ROLE_ADMIN.
 *
 * A broadcast is a fan-out: one row per recipient, which is what keeps every read on the user's
 * side a single indexed query and gives per-user read state for free. There is no "everyone" row
 * to special-case, and no way to un-send — so the audience defaults to the sending admin.
 */
@RestController
@RequestMapping("/api/v1/admin/announcements")
@SecurityRequirement(name = "bearerAuth")
public class AdminAnnouncementController {

    /**
     * Ceiling on one broadcast. Well above this project's user count; it exists so a bug or a
     * runaway import can't turn one click into an unbounded write.
     */
    static final int MAX_RECIPIENTS = 5000;

    private final NotificationService notificationService;
    private final AdminUserService adminUserService;

    public AdminAnnouncementController(NotificationService notificationService,
                                       AdminUserService adminUserService) {
        this.notificationService = notificationService;
        this.adminUserService = adminUserService;
    }

    @GetMapping("/audience")
    @Operation(summary = "How many people a broadcast would reach",
            description = "So the confirm step can name a number before anything is written.")
    public AudienceResponse audience() {
        return new AudienceResponse(adminUserService.allUserIds(MAX_RECIPIENTS).size());
    }

    @PostMapping
    @Operation(summary = "Send an announcement",
            description = "audience=all notifies every user; anything else (including absent) "
                    + "notifies only the sending admin. Returns who it was aimed at and how many "
                    + "rows were written.")
    public ResponseEntity<AnnouncementResultResponse> send(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody AnnouncementRequest request
    ) {
        // Fail towards the smaller audience: only the literal "all" fans out.
        boolean everyone = "all".equals(request.audience());
        String audience = everyone ? "all" : "me";
        List<String> recipients = everyone
                ? adminUserService.allUserIds(MAX_RECIPIENTS)
                : List.of(jwt.getSubject());

        int sent = notificationService.announce(
                recipients, request.title(), request.body(), request.link());

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(new AnnouncementResultResponse(audience, recipients.size(), sent));
    }
}
