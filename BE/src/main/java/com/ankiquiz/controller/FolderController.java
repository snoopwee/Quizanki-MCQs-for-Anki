package com.ankiquiz.controller;

import com.ankiquiz.dto.request.FolderRequest;
import com.ankiquiz.dto.response.FolderDetailResponse;
import com.ankiquiz.dto.response.FolderResponse;
import com.ankiquiz.service.FolderService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Folders belong to the viewer, so they live under {@code /me}. A folder can hold any deck the
 * caller may study — their own or one they saved — and filing changes nothing for its owner.
 */
@RestController
@RequestMapping("/api/v1/me/folders")
@SecurityRequirement(name = "bearerAuth")
public class FolderController {

    private final FolderService folderService;

    public FolderController(FolderService folderService) {
        this.folderService = folderService;
    }

    @GetMapping
    @Operation(summary = "List your folders",
            description = "Name + deck count, without loading the decks. With ?deckId= each folder also "
                    + "says whether it already holds that deck — one call for the deck page's picker.")
    public List<FolderResponse> list(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(value = "deckId", required = false) UUID deckId
    ) {
        return folderService.list(jwt.getSubject(), deckId);
    }

    @GetMapping("/{folderId}")
    @Operation(summary = "One folder and its decks")
    public FolderDetailResponse get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID folderId) {
        return folderService.get(jwt.getSubject(), folderId);
    }

    @PostMapping
    @Operation(summary = "Create a folder", description = "409 when the name is already used in this account.")
    public ResponseEntity<FolderResponse> create(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody FolderRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(folderService.create(jwt.getSubject(), request.name()));
    }

    @PatchMapping("/{folderId}")
    @Operation(summary = "Rename a folder")
    public FolderResponse rename(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID folderId,
            @Valid @RequestBody FolderRequest request
    ) {
        return folderService.rename(jwt.getSubject(), folderId, request.name());
    }

    @DeleteMapping("/{folderId}")
    @Operation(summary = "Delete a folder", description = "The decks inside it are not deleted.")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID folderId) {
        folderService.delete(jwt.getSubject(), folderId);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{folderId}/decks/{deckId}")
    @Operation(summary = "File a deck in a folder", description = "Idempotent; a deck may be in several folders.")
    public ResponseEntity<Void> addDeck(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID folderId,
            @PathVariable UUID deckId
    ) {
        folderService.addDeck(jwt.getSubject(), folderId, deckId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{folderId}/decks/{deckId}")
    @Operation(summary = "Take a deck out of a folder", description = "The deck itself is untouched.")
    public ResponseEntity<Void> removeDeck(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID folderId,
            @PathVariable UUID deckId
    ) {
        folderService.removeDeck(jwt.getSubject(), folderId, deckId);
        return ResponseEntity.noContent().build();
    }
}
