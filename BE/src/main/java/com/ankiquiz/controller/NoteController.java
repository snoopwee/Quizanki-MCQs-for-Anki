package com.ankiquiz.controller;

import com.ankiquiz.dto.request.SetStarRequest;
import com.ankiquiz.dto.request.UpdateNoteRequest;
import com.ankiquiz.dto.response.NoteResponse;
import com.ankiquiz.service.Caller;
import com.ankiquiz.service.NoteService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/decks/{deckId}/notes")
@SecurityRequirement(name = "bearerAuth")
public class NoteController {

    private final NoteService noteService;

    public NoteController(NoteService noteService) {
        this.noteService = noteService;
    }

    @GetMapping
    @Operation(summary = "List notes in a deck",
            description = "Optional tag AND-filter, weakOnly (accuracy < 0.7 or never seen), "
                    + "starredOnly (only starred cards), limit (default 50, max 200).")
    public List<NoteResponse> getNotes(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID deckId,
            @RequestParam(required = false) List<String> tags,
            @RequestParam(defaultValue = "false") boolean weakOnly,
            @RequestParam(defaultValue = "false") boolean starredOnly,
            @RequestParam(required = false) Integer limit
    ) {
        return noteService.getNotes(jwt.getSubject(), deckId, tags, weakOnly, starredOnly, limit);
    }

    @PatchMapping("/{noteId}")
    @Operation(summary = "Edit a flashcard's field values",
            description = "Merges the supplied fields over the note's existing ones; "
                    + "keys outside the note type are ignored. Optionally sets the "
                    + "per-face TTS language override (blank clears it).")
    public NoteResponse updateNote(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID deckId,
            @PathVariable UUID noteId,
            @Valid @RequestBody UpdateNoteRequest request
    ) {
        return noteService.updateNote(Caller.from(jwt), deckId, noteId,
                request.fields(), request.frontLang(), request.backLang(),
                request.frontImageUrl(), request.backImageUrl());
    }

    @PutMapping("/{noteId}/star")
    @Operation(summary = "Star or unstar a flashcard",
            description = "Sets the card's focus flag. Creates a card_stats row if the "
                    + "card was never answered. Returns the note with its updated stats.")
    public NoteResponse setStarred(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID deckId,
            @PathVariable UUID noteId,
            @Valid @RequestBody SetStarRequest request
    ) {
        return noteService.setStarred(jwt.getSubject(), deckId, noteId, request.starred());
    }
}
