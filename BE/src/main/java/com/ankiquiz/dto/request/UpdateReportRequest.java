package com.ankiquiz.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Admin action on a report: status becomes "resolved" or "dismissed", with the reason why.
 *
 * <p>{@code note} is required. A queue that records WHO acted and WHEN but never WHAT they were
 * thinking cannot answer "why is this gone?" six weeks later — and the report row itself is
 * deleted after fifteen days (V37), so the reasoning would go with it. For resolve and dismiss
 * this stays internal; the takedown endpoint has its own request, because that reason is sent to
 * the person it happened to.
 */
public record UpdateReportRequest(
        @NotBlank String status,
        @NotBlank(message = "Say why — it's the only record of this decision.")
        @Size(max = 1000, message = "Keep the reason under 1000 characters.")
        String note
) {
}
