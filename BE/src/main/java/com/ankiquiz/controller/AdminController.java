package com.ankiquiz.controller;

import com.ankiquiz.dto.request.UpdateSiteConfigRequest;
import com.ankiquiz.dto.response.AdminStatsResponse;
import com.ankiquiz.dto.response.PublicDeckPage;
import com.ankiquiz.dto.response.SiteConfigResponse;
import com.ankiquiz.service.AdminService;
import com.ankiquiz.service.DeckService;
import com.ankiquiz.service.SiteConfigService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

/**
 * Admin-only endpoints. Everything under {@code /api/v1/admin/**} is gated to
 * ROLE_ADMIN in SecurityConfig (granted only to the app.admin.* allowlist), so a
 * non-admin hitting any of these gets 403 regardless of the frontend guard.
 *
 * <p>Phase B: deck moderation — list every public deck and either unpublish it
 * (off Discover, owner keeps it) or delete it outright.
 */
@RestController
@RequestMapping("/api/v1/admin")
@SecurityRequirement(name = "bearerAuth")
public class AdminController {

    private final DeckService deckService;
    private final AdminService adminService;
    private final SiteConfigService siteConfigService;

    public AdminController(DeckService deckService, AdminService adminService,
                          SiteConfigService siteConfigService) {
        this.deckService = deckService;
        this.adminService = adminService;
        this.siteConfigService = siteConfigService;
    }

    @GetMapping("/whoami")
    @Operation(summary = "Confirm the caller is recognised as an admin (200 for admins, 403 otherwise)")
    public Map<String, Object> whoami(@AuthenticationPrincipal Jwt jwt) {
        return Map.of("userId", jwt.getSubject(), "admin", true);
    }

    @GetMapping("/stats")
    @Operation(summary = "Site-wide totals for the admin overview dashboard")
    public AdminStatsResponse stats() {
        return adminService.getStats();
    }

    @GetMapping("/decks")
    @Operation(summary = "Every public deck, for moderation",
            description = "Same catalogue as Discover (all shared decks), optionally filtered by a "
                    + "name fragment and paged. Reused so moderation sees exactly what users see.")
    public PublicDeckPage listDecks(
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "20") int limit,
            @RequestParam(defaultValue = "0") int offset
    ) {
        return deckService.getPublicDecks(q, null, null, limit, offset);
    }

    @PostMapping("/decks/{deckId}/unpublish")
    @Operation(summary = "Take a deck off Discover without deleting it (owner keeps the deck)")
    public ResponseEntity<Void> unpublishDeck(@PathVariable UUID deckId) {
        deckService.adminUnpublishDeck(deckId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/decks/{deckId}")
    @Operation(summary = "Delete a deck outright (spam/abuse) — cascades to its notes and progress")
    public ResponseEntity<Void> deleteDeck(@PathVariable UUID deckId) {
        deckService.adminDeleteDeck(deckId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/config")
    @Operation(summary = "The live site settings, for the admin editor")
    public SiteConfigResponse getConfig() {
        return siteConfigService.getConfig();
    }

    @PutMapping("/config")
    @Operation(summary = "Update the live site settings (maintenance mode + announcement)",
            description = "Takes effect on the next client read of /public/config — no redeploy.")
    public SiteConfigResponse updateConfig(@Valid @RequestBody UpdateSiteConfigRequest request) {
        return siteConfigService.updateConfig(request);
    }
}
