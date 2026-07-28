package com.ankiquiz.controller;

import com.ankiquiz.dto.request.AuthorNameRequest;
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

    @PutMapping("/author-name")
    @Operation(summary = "Propagate the user's display name onto the decks they authored",
            description = "Deck author names are stored, not joined (there's no user table), so a "
                    + "profile rename must be pushed to existing decks or they'd show the old name. "
                    + "Body carries the just-set name; a blank body falls back to the JWT name.")
    public Map<String, Integer> syncAuthorName(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody(required = false) AuthorNameRequest request
    ) {
        int updated = deckService.syncAuthorName(Caller.from(jwt), request == null ? null : request.name());
        return Map.of("updated", updated);
    }
}
