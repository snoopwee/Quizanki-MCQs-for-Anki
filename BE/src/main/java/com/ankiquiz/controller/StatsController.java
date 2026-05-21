package com.ankiquiz.controller;

import com.ankiquiz.dto.response.DeckStatsResponse;
import com.ankiquiz.service.StatsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/decks/{deckId}/stats")
@SecurityRequirement(name = "bearerAuth")
public class StatsController {

    private final StatsService statsService;

    public StatsController(StatsService statsService) {
        this.statsService = statsService;
    }

    @GetMapping
    @Operation(summary = "Deck-level performance stats",
            description = "totalCards, seenCards, averageAccuracy, weakCards (< 0.7), masteredCards (streak >= 5).")
    public DeckStatsResponse getStats(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID deckId
    ) {
        return statsService.getDeckStats(jwt.getSubject(), deckId);
    }
}
