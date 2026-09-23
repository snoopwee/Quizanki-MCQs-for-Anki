package com.ankiquiz.controller;

import com.ankiquiz.config.AdminAccess;
import com.ankiquiz.dto.request.AuthorProfileRequest;
import com.ankiquiz.dto.request.UsernameRequest;
import com.ankiquiz.service.Caller;
import com.ankiquiz.service.DeckService;
import com.ankiquiz.service.ProfileService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
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
    private final ProfileService profileService;
    private final AdminAccess adminAccess;

    public ProfileController(DeckService deckService, ProfileService profileService,
                             AdminAccess adminAccess) {
        this.deckService = deckService;
        this.profileService = profileService;
        this.adminAccess = adminAccess;
    }

    @GetMapping
    @Operation(summary = "Who the signed-in user is, plus whether they're an admin",
            description = "The client reads isAdmin to decide whether to show the /admin area. "
                    + "Authoritative on the server too — admin endpoints are gated independently.")
    public Map<String, Object> me(@AuthenticationPrincipal Jwt jwt) {
        // Every page load passes through here, and the access token already carries the name and
        // avatar — so this is where a profile row gets written, with no extra call to Supabase.
        // The token's issue time goes with it: a JWT is a snapshot, and right after a rename the
        // one in hand still says the old name. Without that guard this call would undo the rename
        // on the very next page load.
        profileService.rememberFromToken(Caller.from(jwt), jwt.getIssuedAt());

        String email = jwt.getClaimAsString("email");
        Map<String, Object> me = new LinkedHashMap<>();
        me.put("userId", jwt.getSubject());
        me.put("email", email == null ? "" : email);
        me.put("isAdmin", adminAccess.isAdmin(jwt.getSubject(), email));
        // Read back after the write above, so a brand-new account sees the handle it was just
        // given rather than a blank field. LinkedHashMap because Map.of rejects a null value, and
        // a profile written before V35 has one.
        com.ankiquiz.entity.Profile profile = profileService.find(jwt.getSubject()).orElse(null);
        me.put("username", profile == null ? null : profile.getUsername());
        // False means we picked their handle and they have never seen it — the client asks them to
        // confirm it once, pre-filled, rather than making them invent one mid-signup.
        me.put("usernameChosen", profile != null && profile.isUsernameChosen());
        return me;
    }

    @PutMapping("/username")
    @Operation(summary = "Change your public handle",
            description = "The /user/{username} part of your profile URL. 409 when taken, 400 "
                    + "when the shape is wrong or the name is reserved. Old links to the previous "
                    + "handle stop working — /authors/{userId} does not, and never will.")
    public Map<String, String> changeUsername(@AuthenticationPrincipal Jwt jwt,
                                              @Valid @RequestBody UsernameRequest request) {
        return Map.of("username", profileService.changeUsername(jwt.getSubject(), request.username()));
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
        // Resolved once: the body wins over the token, because a rename reaches Supabase before
        // the JWT carrying it does.
        Caller caller = Caller.from(jwt).withOverrides(name, avatarUrl);

        // The profile row is what the author page reads, so it has to be written HERE and not
        // left to the next GET /me — that one reads the token, which is still a rename behind.
        profileService.remember(caller);

        int updated = deckService.syncAuthorProfile(caller);
        return Map.of("updated", updated);
    }
}
