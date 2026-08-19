package com.ankiquiz.controller;

import com.ankiquiz.dto.request.ReportDeckRequest;
import com.ankiquiz.service.ReportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * A signed-in user flags a deck for admin review. Under {@code /api/v1/decks/**}
 * (authenticated), so guests can't report — and the report is only accepted for a
 * deck they can actually see. Idempotent per (deck, user).
 */
@RestController
@RequestMapping("/api/v1/decks")
@SecurityRequirement(name = "bearerAuth")
public class ReportController {

    private final ReportService reportService;

    public ReportController(ReportService reportService) {
        this.reportService = reportService;
    }

    @PostMapping("/{deckId}/report")
    @Operation(summary = "Report a deck for admin review (spam / inappropriate / etc.)")
    public ResponseEntity<Void> report(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID deckId,
            @Valid @RequestBody(required = false) ReportDeckRequest request
    ) {
        reportService.report(
                jwt.getSubject(), deckId,
                request == null ? null : request.reason(),
                request == null ? null : request.details());
        return ResponseEntity.status(HttpStatus.ACCEPTED).build();
    }
}
