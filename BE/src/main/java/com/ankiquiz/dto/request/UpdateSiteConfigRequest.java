package com.ankiquiz.dto.request;

import jakarta.validation.constraints.Size;

/**
 * Admin edit of the live site settings. Booleans default false when omitted; the
 * messages are optional (blank clears them back to no banner / default message).
 */
public record UpdateSiteConfigRequest(
        boolean maintenanceMode,
        @Size(max = 500) String maintenanceMessage,
        @Size(max = 500) String announcement
) {
}
