package com.ankiquiz.dto.request;

import jakarta.validation.constraints.NotBlank;

/** Admin action on a report: status becomes "resolved" or "dismissed". */
public record UpdateReportRequest(
        @NotBlank String status
) {
}
