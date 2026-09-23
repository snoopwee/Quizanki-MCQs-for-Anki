package com.ankiquiz.controller;

import com.ankiquiz.dto.request.MuteRequest;
import com.ankiquiz.dto.response.NotificationSettingResponse;
import com.ankiquiz.service.NotificationSettingsService;
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
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Which notifications you want. Only kinds you are allowed to switch off are listed — an admin
 * announcement is operational, and the outcome of a report you filed yourself is something you
 * asked for, so neither is offered as a choice.
 */
@RestController
@RequestMapping("/api/v1/me/notification-settings")
@SecurityRequirement(name = "bearerAuth")
public class NotificationSettingsController {

    private final NotificationSettingsService settingsService;

    public NotificationSettingsController(NotificationSettingsService settingsService) {
        this.settingsService = settingsService;
    }

    @GetMapping
    @Operation(summary = "The notification kinds you can switch off, and whether you have")
    public List<NotificationSettingResponse> settings(@AuthenticationPrincipal Jwt jwt) {
        return settingsService.settings(jwt.getSubject());
    }

    @PutMapping("/{kind}")
    @Operation(summary = "Switch one kind off or back on",
            description = "Idempotent both ways. 400 for a kind that can't be switched off, 404 "
                    + "for one this app doesn't have.")
    public ResponseEntity<Void> setMuted(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable String kind,
            @Valid @RequestBody MuteRequest request
    ) {
        settingsService.setMuted(jwt.getSubject(), kind, request.muted());
        return ResponseEntity.noContent().build();
    }
}
