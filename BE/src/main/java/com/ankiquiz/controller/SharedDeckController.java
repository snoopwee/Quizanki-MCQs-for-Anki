package com.ankiquiz.controller;

import com.ankiquiz.dto.response.AuthorPageResponse;
import com.ankiquiz.dto.response.DeckContentsResponse;
import com.ankiquiz.dto.response.PublicDeckPage;
import com.ankiquiz.service.DeckService;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

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

    public SharedDeckController(DeckService deckService) {
        this.deckService = deckService;
    }

    @GetMapping("/shared/{deckId}")
    @Operation(summary = "Read a shared deck's contents (public, no auth)",
            description = "Returns the same shape as /decks/{id}/contents. 404 if the deck "
                    + "doesn't exist or its owner hasn't shared it.")
    public DeckContentsResponse getSharedDeck(@PathVariable UUID deckId) {
        return deckService.getPublicDeckContents(deckId);
    }

    @GetMapping("/authors/{authorId}")
    @Operation(summary = "An author's public decks (public, no auth)",
            description = "All decks credited to the author that are currently shared, newest "
                    + "first, plus their current display name. Empty when the author has no "
                    + "public decks.")
    public AuthorPageResponse getAuthor(@PathVariable String authorId) {
        return deckService.getAuthorPage(authorId);
    }

    @GetMapping("/discover")
    @Operation(summary = "Browse every shared deck (public, no auth)",
            description = "Newest-shared first, optionally narrowed by a case-insensitive name "
                    + "fragment and a card-count range (minCards/maxCards, inclusive; either may "
                    + "be omitted). Paged — page size is capped server-side; the response carries "
                    + "the total so the client can render a pager.")
    public PublicDeckPage discover(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Integer minCards,
            @RequestParam(required = false) Integer maxCards,
            @RequestParam(defaultValue = "12") int limit,
            @RequestParam(defaultValue = "0") int offset
    ) {
        return deckService.getPublicDecks(q, minCards, maxCards, limit, offset);
    }
}
