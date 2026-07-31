package com.ankiquiz.dto.request;

import jakarta.validation.constraints.Size;

/**
 * A user's deck report. Both fields optional: {@code reason} is a short category
 * ("Spam", "Inappropriate", …), {@code details} is free text.
 */
public record ReportDeckRequest(
        @Size(max = 60) String reason,
        @Size(max = 1000) String details
) {
}
