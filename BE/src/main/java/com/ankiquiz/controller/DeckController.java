package com.ankiquiz.controller;

import com.ankiquiz.dto.request.ImportDeckRequest;
import com.ankiquiz.dto.response.DeckContentsResponse;
import com.ankiquiz.dto.response.DeckResponse;
import com.ankiquiz.service.DeckService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/decks")
@SecurityRequirement(name = "bearerAuth")
public class DeckController {

    private final DeckService deckService;

    public DeckController(DeckService deckService) {
        this.deckService = deckService;
    }

    @GetMapping
    @Operation(summary = "List the authenticated user's decks")
    public List<DeckResponse> getDecks(@AuthenticationPrincipal Jwt jwt) {
        return deckService.getDecksForUser(jwt.getSubject());
    }

    @PostMapping
    @Operation(summary = "Import a deck with its notes",
            description = "Creates a deck row and upserts notes by (deck_id, anki_note_id).")
    public ResponseEntity<DeckResponse> importDeck(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody ImportDeckRequest request
    ) {
        DeckResponse body = deckService.importDeck(jwt.getSubject(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(body);
    }

    @GetMapping("/{deckId}/contents")
    @Operation(summary = "Get a deck's full flashcard structure (note types + notes)",
            description = "Returns the deck in the same shape as /public/parse-apkg so the client "
                    + "can study it as flashcards and set up a test from it.")
    public DeckContentsResponse getDeckContents(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID deckId
    ) {
        return deckService.getDeckContents(jwt.getSubject(), deckId);
    }

    @DeleteMapping("/{deckId}")
    @Operation(summary = "Delete a deck (cascades to notes and card stats)")
    public ResponseEntity<Void> deleteDeck(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID deckId
    ) {
        deckService.deleteDeck(jwt.getSubject(), deckId);
        return ResponseEntity.noContent().build();
    }
}
