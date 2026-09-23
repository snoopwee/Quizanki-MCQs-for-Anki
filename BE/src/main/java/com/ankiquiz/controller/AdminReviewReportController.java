package com.ankiquiz.controller;

import com.ankiquiz.dto.request.UpdateReportRequest;
import com.ankiquiz.dto.response.AdminReviewReportResponse;
import com.ankiquiz.service.ReviewReportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
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
 * The admin queue for reported rating notes. Under {@code /api/v1/admin/**}, so ROLE_ADMIN-gated in
 * SecurityConfig — the same gate the deck-report queue sits behind.
 *
 * <p>Rows carry the reported text and no writer identity: this queue judges text. Acting on the
 * person is the user tools, which is the one moment identity is warranted.
 */
@RestController
@RequestMapping("/api/v1/admin/review-reports")
@SecurityRequirement(name = "bearerAuth")
public class AdminReviewReportController {

    private final ReviewReportService reviewReportService;

    public AdminReviewReportController(ReviewReportService reviewReportService) {
        this.reviewReportService = reviewReportService;
    }

    @GetMapping
    @Operation(summary = "List reported notes, optionally filtered by status (default: all)")
    public List<AdminReviewReportResponse> list(@RequestParam(required = false) String status) {
        return reviewReportService.list(status);
    }

    @PutMapping("/{reportId}")
    @Operation(summary = "Resolve or dismiss a reported note",
            description = "Notifies whoever reported it either way, so the queue isn't a black hole.")
    public ResponseEntity<Void> update(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID reportId,
            @Valid @RequestBody UpdateReportRequest request
    ) {
        reviewReportService.updateStatus(reportId, request.status(), jwt.getSubject());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{reportId}/rating")
    @Operation(summary = "Take the reported rating down",
            description = "Removes the rating outright — stars and note — and recomputes the deck's "
                    + "score. Unlike the author's own delete, which only clears text: the note is "
                    + "private and the star is public, so removing just the text would leave the "
                    + "abuser's mark on the score. 204 whether or not it was still there.")
    public ResponseEntity<Void> takeDownRating(@PathVariable UUID reportId) {
        reviewReportService.takeDownRating(reportId);
        return ResponseEntity.noContent().build();
    }
}
