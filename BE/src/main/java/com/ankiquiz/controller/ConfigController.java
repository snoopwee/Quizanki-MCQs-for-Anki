package com.ankiquiz.controller;

import com.ankiquiz.dto.response.SiteConfigResponse;
import com.ankiquiz.service.SiteConfigService;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * The public read of the live site settings. Unauthenticated on purpose — every
 * client (guest or signed-in) fetches this on load to apply maintenance mode and
 * the announcement banner. Under {@code /api/v1/public/**}, so it's whitelisted in
 * SecurityConfig. Admin writes go through {@code PUT /api/v1/admin/config}.
 */
@RestController
@RequestMapping("/api/v1/public/config")
public class ConfigController {

    private final SiteConfigService siteConfigService;

    public ConfigController(SiteConfigService siteConfigService) {
        this.siteConfigService = siteConfigService;
    }

    @GetMapping
    @Operation(summary = "The live site settings (maintenance mode + announcement) — public")
    public SiteConfigResponse get() {
        return siteConfigService.getConfig();
    }
}
