package com.ankiquiz.controller;

import com.ankiquiz.dto.request.AuthorProfileRequest;
import com.ankiquiz.service.Caller;
import com.ankiquiz.service.DeckService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * The signed-in user's profile actions that reach into our own data. (Identity
 * itself lives in Supabase auth; this is only for the things a rename must
 * propagate to.)
 */
@RestController
@RequestMapping("/api/v1/me")
@SecurityRequirement(name = "bearerAuth")
public class ProfileController {

    private final DeckService deckService;

    public ProfileController(DeckService deckService) {
        this.deckService = deckService;
    }

    @PutMapping("/author-profile")
    @Operation(summary = "Propagate the user's name + avatar onto the decks they authored",
            description = "Deck author name/avatar are stored, not joined (there's no user table), so "
                    + "a profile change must be pushed to existing decks or they'd show the old values. "
                    + "Body carries the just-set name + avatar; a blank name falls back to the JWT name.")
    public Map<String, Integer> syncAuthorProfile(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody(required = false) AuthorProfileRequest request
    ) {
        String name = request == null ? null : request.name();
        String avatarUrl = request == null ? null : request.avatarUrl();
        int updated = deckService.syncAuthorProfile(Caller.from(jwt), name, avatarUrl);
        return Map.of("updated", updated);
    }
}
