package com.ankiquiz.controller;

import com.ankiquiz.dto.request.DeckRatingRequest;
import com.ankiquiz.dto.response.DeckRatingResponse;
import com.ankiquiz.service.DeckRatingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * One deck's rating, from the caller's point of view: the public score, and their own rating.
 *
 * Rating is signed-in only, so this sits under the authenticated tree rather than with the public
 * deck routes. The note a caller sends is private feedback for the deck's author — the only note
 * these endpoints ever return is the caller's own.
 */
@RestController
@RequestMapping("/api/v1/decks/{deckId}/rating")
@SecurityRequirement(name = "bearerAuth")
public class DeckRatingController {

    private final DeckRatingService deckRatingService;

    public DeckRatingController(DeckRatingService deckRatingService) {
        this.deckRatingService = deckRatingService;
    }

    @GetMapping
    @Operation(summary = "This deck's score, and your own rating of it")
    public DeckRatingResponse get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID deckId) {
        return deckRatingService.get(jwt.getSubject(), deckId);
    }

    @PutMapping
    @Operation(summary = "Rate this deck",
            description = "Upsert: rating again replaces your previous one. 409 on your own deck. "
                    + "`note` is private — only the deck's author can read it.")
    public DeckRatingResponse rate(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID deckId,
            @Valid @RequestBody DeckRatingRequest request
    ) {
        return deckRatingService.rate(jwt.getSubject(), deckId, request.stars(), request.note());
    }

    @DeleteMapping
    @Operation(summary = "Take back your rating",
            description = "Idempotent, and returns the deck's score without it.")
    public DeckRatingResponse remove(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID deckId) {
        return deckRatingService.remove(jwt.getSubject(), deckId);
    }
}
