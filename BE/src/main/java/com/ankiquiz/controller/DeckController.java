package com.ankiquiz.controller;

import com.ankiquiz.dto.request.ImportDeckRequest;
import com.ankiquiz.dto.request.SetDeckLanguagesRequest;
import com.ankiquiz.dto.request.UpdateDeckContentsRequest;
import com.ankiquiz.dto.request.UpdateDeckRequest;
import com.ankiquiz.dto.response.DeckContentsResponse;
import com.ankiquiz.dto.response.DeckResponse;
import com.ankiquiz.service.ApkgExportService;
import com.ankiquiz.service.DeckService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
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
    private final ApkgExportService apkgExportService;

    public DeckController(DeckService deckService, ApkgExportService apkgExportService) {
        this.deckService = deckService;
        this.apkgExportService = apkgExportService;
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

    @GetMapping(value = "/{deckId}/export.apkg", produces = MediaType.APPLICATION_OCTET_STREAM_VALUE)
    @Operation(summary = "Export a deck as an Anki .apkg package",
            description = "Builds a schema-11 Anki collection (notes + fields only; no scheduling or media).")
    public ResponseEntity<byte[]> exportApkg(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID deckId
    ) {
        byte[] body = apkgExportService.export(jwt.getSubject(), deckId);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"deck.apkg\"")
                .body(body);
    }

    @PutMapping("/{deckId}/contents")
    @Operation(summary = "Replace a deck's name + full card set (flashcard editor save)",
            description = "Reconciles the supplied cards against stored notes (update/insert/delete), "
                    + "reorders by index, and applies front/back layout swaps. Last-write-wins.")
    public DeckContentsResponse replaceContents(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID deckId,
            @Valid @RequestBody UpdateDeckContentsRequest request
    ) {
        return deckService.replaceDeckContents(jwt.getSubject(), deckId, request);
    }

    @PatchMapping("/{deckId}")
    @Operation(summary = "Rename a deck")
    public DeckResponse updateDeck(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID deckId,
            @Valid @RequestBody UpdateDeckRequest request
    ) {
        return deckService.renameDeck(jwt.getSubject(), deckId, request.name());
    }

    @PutMapping("/{deckId}/languages")
    @Operation(summary = "Set a deck's primary TTS language per face",
            description = "Sets the term (front) and definition (back) primary language "
                    + "used for text-to-speech. A blank value clears it back to auto-detect. "
                    + "Returns the refreshed deck contents.")
    public DeckContentsResponse setDeckLanguages(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID deckId,
            @Valid @RequestBody SetDeckLanguagesRequest request
    ) {
        return deckService.setDeckLanguages(jwt.getSubject(), deckId, request.frontLang(), request.backLang());
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
