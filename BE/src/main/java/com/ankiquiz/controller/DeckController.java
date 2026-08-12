package com.ankiquiz.controller;

import com.ankiquiz.dto.request.ImportAudioRequest;
import com.ankiquiz.dto.request.ImportDeckRequest;
import com.ankiquiz.dto.request.SaveDeckRequest;
import com.ankiquiz.dto.request.SetDeckLanguagesRequest;
import com.ankiquiz.dto.request.ShareDeckRequest;
import com.ankiquiz.dto.request.UpdateDeckContentsRequest;
import com.ankiquiz.dto.request.UpdateDeckRequest;
import com.ankiquiz.dto.response.AudioImportResponse;
import com.ankiquiz.dto.response.DeckContentsResponse;
import com.ankiquiz.dto.response.DeckResponse;
import com.ankiquiz.service.ApkgAudioImportService;
import com.ankiquiz.service.ApkgExportService;
import com.ankiquiz.service.Caller;
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
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/decks")
@SecurityRequirement(name = "bearerAuth")
public class DeckController {

    private final DeckService deckService;
    private final ApkgExportService apkgExportService;
    private final ApkgAudioImportService apkgAudioImportService;

    public DeckController(DeckService deckService,
                          ApkgExportService apkgExportService,
                          ApkgAudioImportService apkgAudioImportService) {
        this.deckService = deckService;
        this.apkgExportService = apkgExportService;
        this.apkgAudioImportService = apkgAudioImportService;
    }

    @GetMapping
    @Operation(summary = "List the authenticated user's decks")
    public List<DeckResponse> getDecks(@AuthenticationPrincipal Jwt jwt) {
        return deckService.getDecksForUser(jwt.getSubject());
    }

    @GetMapping("/saved")
    @Operation(summary = "The user's Saved tab: decks they bookmarked but don't own")
    public List<DeckResponse> getSaved(@AuthenticationPrincipal Jwt jwt) {
        return deckService.getSavedDecks(jwt.getSubject());
    }

    @GetMapping("/recent")
    @Operation(summary = "The user's Recent tab: decks opened in the last 30 days")
    public List<DeckResponse> getRecent(@AuthenticationPrincipal Jwt jwt) {
        return deckService.getRecentDecks(jwt.getSubject());
    }

    @PostMapping("/{deckId}/open")
    @Operation(summary = "Mark a deck opened (adds it to Recent)",
            description = "Called when the deck page loads. Studiable decks only (owned, public, or "
                    + "saved); anything else 404s.")
    public ResponseEntity<Void> openDeck(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID deckId
    ) {
        deckService.openDeck(jwt.getSubject(), deckId);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{deckId}/save")
    @Operation(summary = "Bookmark a deck to Home, or remove it",
            description = "\"Save to Home\" — a reference, not a copy. A saved deck stays "
                    + "accessible even if its owner later makes it private.")
    public ResponseEntity<Void> setSaved(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID deckId,
            @Valid @RequestBody SaveDeckRequest request
    ) {
        deckService.setSaved(jwt.getSubject(), deckId, request.saved());
        return ResponseEntity.noContent().build();
    }

    @PostMapping
    @Operation(summary = "Import a deck with its notes",
            description = "Creates a deck row and upserts notes by (deck_id, anki_note_id).")
    public ResponseEntity<DeckResponse> importDeck(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody ImportDeckRequest request
    ) {
        DeckResponse body = deckService.importDeck(Caller.from(jwt), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(body);
    }

    @PostMapping(value = "/{deckId}/import-audio", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Import an .apkg's audio onto a just-saved deck",
            description = "Multipart: the original .apkg ('apkg') plus the per-note [sound:] refs "
                    + "('refs', application/json) collected at parse time. Streams just the referenced "
                    + "clips to storage and sets each note's front/back audio. Owner-only; best-effort "
                    + "(missing / oversized / non-audio media is skipped).")
    public AudioImportResponse importDeckAudio(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID deckId,
            @RequestPart("apkg") MultipartFile apkg,
            @RequestPart("refs") ImportAudioRequest refs
    ) {
        return apkgAudioImportService.importAudio(jwt.getSubject(), deckId, apkg, refs.notes());
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
        return deckService.replaceDeckContents(Caller.from(jwt), deckId, request);
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

    @PatchMapping("/{deckId}/share")
    @Operation(summary = "Turn a deck's public share link on or off",
            description = "While shared, anyone holding /shared/{deckId} can preview the deck "
                    + "and clone it into their own account. The owner's deck and progress are "
                    + "never modified by a clone. Off by default.")
    public DeckResponse setDeckSharing(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID deckId,
            @Valid @RequestBody ShareDeckRequest request
    ) {
        return deckService.setDeckSharing(jwt.getSubject(), deckId, request.isPublic());
    }

    @PostMapping("/{deckId}/clone")
    @Operation(summary = "Copy a shared deck into the caller's account",
            description = "Creates an independent deck with its own notes — and therefore its own "
                    + "progress. No card stats are copied. Allowed when the source is shared, or "
                    + "when the caller already owns it (a plain duplicate); otherwise 404.")
    public ResponseEntity<DeckResponse> cloneDeck(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID deckId
    ) {
        DeckResponse body = deckService.cloneDeck(Caller.from(jwt), deckId);
        return ResponseEntity.status(HttpStatus.CREATED).body(body);
    }

    @GetMapping("/{deckId}/copies")
    @Operation(summary = "How many copies people have taken of this deck")
    public Map<String, Long> countCopies(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID deckId
    ) {
        return Map.of("copies", deckService.countCopies(jwt.getSubject(), deckId));
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
