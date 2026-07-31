package com.ankiquiz.controller;

import com.ankiquiz.dto.request.UpdateReportRequest;
import com.ankiquiz.dto.response.AdminReportResponse;
import com.ankiquiz.service.ReportService;
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

import java.util.List;
import java.util.UUID;

/**
 * The admin reports queue. Under {@code /api/v1/admin/**}, so ROLE_ADMIN-gated in
 * SecurityConfig. Resolving/dismissing a report is the review action; moderating
 * the deck itself (unpublish/delete) uses the existing deck-moderation endpoints.
 */
@RestController
@RequestMapping("/api/v1/admin/reports")
@SecurityRequirement(name = "bearerAuth")
public class AdminReportController {

    private final ReportService reportService;

    public AdminReportController(ReportService reportService) {
        this.reportService = reportService;
    }

    @GetMapping
    @Operation(summary = "List deck reports, optionally filtered by status (default: all)")
    public List<AdminReportResponse> list(@RequestParam(required = false) String status) {
        return reportService.listReports(status);
    }

    @PutMapping("/{reportId}")
    @Operation(summary = "Resolve or dismiss a report")
    public ResponseEntity<Void> update(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID reportId,
            @Valid @RequestBody UpdateReportRequest request
    ) {
        reportService.updateStatus(reportId, request.status(), jwt.getSubject());
        return ResponseEntity.noContent().build();
    }
}
