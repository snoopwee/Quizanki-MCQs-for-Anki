package com.ankiquiz.dto.response;

import com.ankiquiz.entity.SiteConfig;

/**
 * The live site settings the frontend reads on load (public — every client needs
 * it) and the admin config editor reads back. {@code maintenanceMessage} /
 * {@code announcement} are null when unset.
 */
public record SiteConfigResponse(
        boolean maintenanceMode,
        String maintenanceMessage,
        String announcement
) {
    public static SiteConfigResponse from(SiteConfig c) {
        return new SiteConfigResponse(c.isMaintenanceMode(), c.getMaintenanceMessage(), c.getAnnouncement());
    }
}
