package com.ankiquiz.controller;

import com.ankiquiz.dto.request.StudyActivityRequest;
import com.ankiquiz.dto.response.StreakResponse;
import com.ankiquiz.service.ClientZone;
import com.ankiquiz.service.StreakService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

// The caller's timezone travels as a query parameter / body field, deliberately NOT as an
// X-Timezone header. A custom header has to be allowed by CORS, and the frontend (Vercel) and
// backend (Render) deploy separately: a frontend shipped first would fail every request's
// preflight and take the whole site down. Older backends ignore unknown fields and parameters,
// so this way the two can deploy in either order.
@RestController
@RequestMapping("/api/v1/me")
@SecurityRequirement(name = "bearerAuth")
public class StreakController {

    private final StreakService streakService;

    public StreakController(StreakService streakService) {
        this.streakService = streakService;
    }

    @GetMapping("/streak")
    @Operation(summary = "Get the daily study streak",
            description = "Current and longest streak plus the last 7 days, computed in the caller's timezone (tz).")
    public StreakResponse getStreak(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(value = "tz", required = false) String tz
    ) {
        return streakService.getStreak(jwt.getSubject(), ClientZone.parse(tz));
    }

    @PostMapping("/activity")
    @Operation(summary = "Mark today as a study day",
            description = "For study that records no graded answer. Idempotent per local day.")
    public ResponseEntity<Void> recordActivity(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody StudyActivityRequest request
    ) {
        streakService.markStudied(jwt.getSubject(), ClientZone.parse(request.timezone()), request.source());
        return ResponseEntity.noContent().build();
    }
}
