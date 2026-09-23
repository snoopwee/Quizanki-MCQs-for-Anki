package com.ankiquiz.controller;

import com.ankiquiz.dto.response.AuthorPageResponse;
import com.ankiquiz.dto.response.DeckContentsResponse;
import com.ankiquiz.dto.response.PublicDeckPage;
import com.ankiquiz.service.DeckService;
import com.ankiquiz.service.ProfileService;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Unauthenticated reads of decks their owners have shared: one deck by id (the
 * {@code /shared/{deckId}} page) and the Discover directory listing.
 *
 * <p>Browsing is deliberately open to guests — only <em>copying</em> a deck needs
 * an account, and that lives on the authenticated {@code POST /decks/{id}/clone}.
 *
 * <p>Whitelisted in {@code SecurityConfig} under {@code /api/v1/public/**}. A
 * deck's own UUID is its share token — the service 404s anything not currently
 * shared, so a link can't be used to probe for private decks.
 */
@RestController
@RequestMapping("/api/v1/public")
public class SharedDeckController {

    private final DeckService deckService;
    private final ProfileService profileService;

    public SharedDeckController(DeckService deckService, ProfileService profileService) {
        this.deckService = deckService;
        this.profileService = profileService;
    }

    @GetMapping("/shared/{deckId}")
    @Operation(summary = "Read a shared deck's contents (public, no auth)",
            description = "Returns the same shape as /decks/{id}/contents. 404 if the deck "
                    + "doesn't exist or its owner hasn't shared it.")
    public DeckContentsResponse getSharedDeck(@PathVariable UUID deckId) {
        return deckService.getPublicDeckContents(deckId);
    }

    @GetMapping("/authors/{authorId}")
    @Operation(summary = "A user's public profile page (public, no auth)",
            description = "Their current display name and avatar, their follower count, and every "
                    + "deck credited to them that is currently shared, newest first. An empty deck "
                    + "list is a real page: publishing nothing is not the same as not existing. "
                    + "404 only for a user with neither a profile nor a public deck.")
    public AuthorPageResponse getAuthor(@PathVariable String authorId) {
        return deckService.getAuthorPage(authorId);
    }

    @GetMapping("/users/{username}")
    @Operation(summary = "A user's public profile page, by handle (public, no auth)",
            description = "The readable form of /public/authors/{id} — same payload, resolved "
                    + "through the unique username. 404 when no such handle exists.")
    public AuthorPageResponse getUserPage(@PathVariable String username) {
        return deckService.getUserPage(username);
    }

    @GetMapping("/usernames/{username}/available")
    @Operation(summary = "Is this handle free? (public, no auth)",
            description = "Asked from the sign-up form, before the account it would belong to "
                    + "exists — which is why it can't require a token. Answers the shape rules "
                    + "too, so the form can say WHY rather than just refusing. Availability is "
                    + "advisory: the claim is settled when the profile row is written.")
    public Map<String, Object> usernameAvailable(@PathVariable String username) {
        String reason = profileService.unavailableBecause(username);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("available", reason == null);
        body.put("reason", reason);
        return body;
    }

    @GetMapping("/discover")
    @Operation(summary = "Browse every shared deck (public, no auth)",
            description = "Newest-shared first by default, or best-rated with sort=rated (decks "
                    + "with too few ratings to rank still appear, below the ones that do). "
                    + "Optionally narrowed by a case-insensitive name fragment and a card-count "
                    + "range (minCards/maxCards, inclusive; either may be omitted). Paged — page "
                    + "size is capped server-side; the response carries the total so the client "
                    + "can render a pager.")
    public PublicDeckPage discover(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Integer minCards,
            @RequestParam(required = false) Integer maxCards,
            @RequestParam(defaultValue = "12") int limit,
            @RequestParam(defaultValue = "0") int offset,
            @RequestParam(required = false) String sort
    ) {
        return deckService.getPublicDecks(q, minCards, maxCards, limit, offset, sort);
    }
}
