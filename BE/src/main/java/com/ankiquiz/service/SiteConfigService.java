package com.ankiquiz.service;

import com.ankiquiz.dto.request.UpdateSiteConfigRequest;
import com.ankiquiz.dto.response.SiteConfigResponse;
import com.ankiquiz.entity.SiteConfig;
import com.ankiquiz.repository.SiteConfigRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;

/**
 * The single live site-settings row. Reads are public (every client applies
 * maintenance mode + the announcement on load); writes are admin-only, gated at
 * the controller. V14 seeds the row, but we defensively create it if it's missing.
 */
@Service
public class SiteConfigService {

    private static final int SINGLETON_ID = 1;

    private final SiteConfigRepository repository;

    public SiteConfigService(SiteConfigRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public SiteConfigResponse getConfig() {
        return SiteConfigResponse.from(loadOrDefault());
    }

    @Transactional
    public SiteConfigResponse updateConfig(UpdateSiteConfigRequest request) {
        SiteConfig config = loadOrDefault();
        config.setMaintenanceMode(request.maintenanceMode());
        config.setMaintenanceMessage(trimToNull(request.maintenanceMessage()));
        config.setAnnouncement(trimToNull(request.announcement()));
        config.setUpdatedAt(OffsetDateTime.now());
        return SiteConfigResponse.from(repository.save(config));
    }

    private SiteConfig loadOrDefault() {
        return repository.findById(SINGLETON_ID).orElseGet(() -> {
            SiteConfig config = new SiteConfig();
            config.setId(SINGLETON_ID);
            config.setMaintenanceMode(false);
            config.setUpdatedAt(OffsetDateTime.now());
            return repository.save(config);
        });
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
