package com.ankiquiz.controller;

import com.ankiquiz.dto.request.DeckRatingRequest;
import com.ankiquiz.dto.request.ReportNoteRequest;
import com.ankiquiz.dto.response.DeckFeedbackResponse;
import com.ankiquiz.dto.response.DeckRatingResponse;
import com.ankiquiz.service.DeckRatingService;
import com.ankiquiz.service.ReviewReportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.http.ResponseEntity;
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
    private final ReviewReportService reviewReportService;

    public DeckRatingController(DeckRatingService deckRatingService,
                                ReviewReportService reviewReportService) {
        this.deckRatingService = deckRatingService;
        this.reviewReportService = reviewReportService;
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

    @GetMapping("/notes")
    @Operation(summary = "The notes people left on your deck (author only)",
            description = "404 for anyone but the deck's owner — whether a deck has feedback is "
                    + "the author's business. Carries no names: one rating per person per deck "
                    + "already makes each note a different voice.")
    public DeckFeedbackResponse feedback(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID deckId) {
        return deckRatingService.feedback(jwt.getSubject(), deckId);
    }

    @PostMapping("/notes/{noteId}/report")
    @Operation(summary = "Report a note to an admin (author only)",
            description = "For a note that is abusive rather than merely unwelcome. The reported "
                    + "text is copied into the report, so it survives being deleted afterwards. "
                    + "Reporting the same note twice is a no-op.")
    public ResponseEntity<Void> reportNote(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID deckId,
            @PathVariable UUID noteId,
            @Valid @RequestBody ReportNoteRequest request
    ) {
        reviewReportService.report(jwt.getSubject(), deckId, noteId, request.reason(), request.details());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/notes/{noteId}")
    @Operation(summary = "Clear one note (author only)",
            description = "Removes the text; the RATING it came with stands. An author who could "
                    + "delete ratings would leave a score reflecting only the ones they liked. "
                    + "204 whether or not a note was there.")
    public ResponseEntity<Void> deleteNote(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID deckId,
            @PathVariable UUID noteId
    ) {
        deckRatingService.deleteNote(jwt.getSubject(), deckId, noteId);
        return ResponseEntity.noContent().build();
    }
}
