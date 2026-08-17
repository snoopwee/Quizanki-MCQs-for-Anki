package com.ankiquiz.controller;

import com.ankiquiz.dto.response.MediaGcReport;
import com.ankiquiz.dto.response.MediaGcResult;
import com.ankiquiz.service.MediaGcService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Admin-only orphan-media garbage collection. {@code GET /orphans} is a safe dry run
 * (preview what would be reclaimed); {@code POST /gc} actually deletes. Both are under
 * {@code /api/v1/admin/**}, which SecurityConfig gates on {@code ROLE_ADMIN}. An
 * external scheduler can POST /gc on a cadence to make GC automatic without an
 * always-on process.
 */
@RestController
@RequestMapping("/api/v1/admin/media")
@SecurityRequirement(name = "bearerAuth")
public class AdminMediaController {

    private final MediaGcService gc;

    public AdminMediaController(MediaGcService gc) {
        this.gc = gc;
    }

    @GetMapping("/orphans")
    @Operation(summary = "Preview reclaimable orphaned media (dry run — deletes nothing)",
            description = "Returns how many media objects are referenced by no note and older than the grace "
                    + "window, and how many bytes they occupy. Run this first to sanity-check before deleting.")
    public MediaGcReport orphans(@AuthenticationPrincipal Jwt jwt) {
        return gc.report();
    }

    @PostMapping("/gc")
    @Operation(summary = "Delete orphaned media past the grace window",
            description = "Deletes the Storage object + registry row for media referenced by no note and older "
                    + "than the grace window. Bounded per run (media.gc.max-per-run; override with ?max=). Safe "
                    + "to schedule via an external cron once the dry run looks right.")
    public MediaGcResult collect(@AuthenticationPrincipal Jwt jwt,
                                 @RequestParam(name = "max", required = false) Integer max) {
        return gc.collect(max);
    }
}
