package com.ankiquiz.controller;

import com.ankiquiz.dto.response.AuthorPageResponse;
import com.ankiquiz.dto.response.DeckContentsResponse;
import com.ankiquiz.dto.response.PublicDeckPage;
import com.ankiquiz.dto.response.PublicDeckSummary;
import com.ankiquiz.service.DeckService;
import com.ankiquiz.service.ProfileService;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
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

    /**
     * How long a client may reuse a public read without asking again.
     *
     * <p><b>Why time-bounded caching and not a validator.</b> Measured 2026-10-05 against the
     * largest public deck (3,787 cards): {@code GET /public/shared/{id}} answers in ~2.0s, of which
     * <b>TTFB is ~1.6s</b> — the query and serialising 3.8 MB — and only ~0.35s is transfer. So the
     * expensive part is producing the response, and anything that still has to produce it saves
     * almost nothing. That rules out an ETag hashed from the body (and rules out
     * {@code ShallowEtagHeaderFilter} twice over: it buffers the whole 3.8 MB in memory to hash it,
     * on a 512 MB instance). {@code max-age} is the one option that skips the work entirely — the
     * browser does not ask at all.
     *
     * <p>A {@code Last-Modified} validator off a {@code decks.updated_at} column would be stronger,
     * and was the original plan. It was dropped on purpose: the deck's CONTENTS include its notes
     * and note types, written from five different places, so the column has to be maintained
     * everywhere or a 304 serves cards that have changed — worse than being slow. A trigger would
     * be correct by construction but Hibernate's JDBC batching issues one INSERT statement per
     * note, so even a statement-level trigger fires thousands of times per import, against the one
     * row it keeps updating. Sixty seconds of staleness on a public page somebody else published is
     * a far better trade than either.
     *
     * <p>{@code public} is accurate here: these endpoints are unauthenticated and their response
     * does not vary by viewer.
     */
    private static final CacheControl PUBLIC_READ = CacheControl.maxAge(Duration.ofSeconds(60)).cachePublic();

    /** A link preview or crawler re-reads this far more often than it changes. */
    private static final CacheControl PUBLIC_SUMMARY = CacheControl.maxAge(Duration.ofMinutes(5)).cachePublic();

    private final DeckService deckService;
    private final ProfileService profileService;

    public SharedDeckController(DeckService deckService, ProfileService profileService) {
        this.deckService = deckService;
        this.profileService = profileService;
    }

    @GetMapping("/shared/{deckId}")
    @Operation(summary = "Read a shared deck's contents (public, no auth)",
            description = "Returns the same shape as /decks/{id}/contents. 404 if the deck "
                    + "doesn't exist or its owner hasn't shared it. Cacheable for 60s: this is the "
                    + "app's largest response (3.8 MB for a big deck) and it is the same for "
                    + "everybody.")
    public ResponseEntity<DeckContentsResponse> getSharedDeck(@PathVariable UUID deckId) {
        return ResponseEntity.ok()
                .cacheControl(PUBLIC_READ)
                .body(deckService.getPublicDeckContents(deckId));
    }

    @GetMapping("/authors/{authorId}")
    @Operation(summary = "A user's public profile page (public, no auth)",
            description = "Their current display name and avatar, their follower count, and every "
                    + "deck credited to them that is currently shared, newest first. An empty deck "
                    + "list is a real page: publishing nothing is not the same as not existing. "
                    + "404 only for a user with neither a profile nor a public deck.")
    public ResponseEntity<AuthorPageResponse> getAuthor(@PathVariable String authorId) {
        return ResponseEntity.ok()
                .cacheControl(PUBLIC_READ)
                .body(deckService.getAuthorPage(authorId));
    }

    @GetMapping("/shared/{deckId}/summary")
    @Operation(summary = "A shared deck in one line (public, no auth)",
            description = "Name, card count, who made it, its score — what a link preview and a "
                    + "search engine need. Separate from /shared/{deckId} because that returns "
                    + "every card: 3.8 MB for a large deck, to build a title.")
    public ResponseEntity<PublicDeckSummary> getSharedDeckSummary(@PathVariable UUID deckId) {
        return ResponseEntity.ok()
                .cacheControl(PUBLIC_SUMMARY)
                .body(deckService.getPublicDeckSummary(deckId));
    }

    @GetMapping("/users/{username}")
    @Operation(summary = "A user's public profile page, by handle (public, no auth)",
            description = "The readable form of /public/authors/{id} — same payload, resolved "
                    + "through the unique username. 404 when no such handle exists.")
    public ResponseEntity<AuthorPageResponse> getUserPage(@PathVariable String username) {
        return ResponseEntity.ok()
                .cacheControl(PUBLIC_READ)
                .body(deckService.getUserPage(username));
    }

    @GetMapping("/usernames/{username}/available")
    @Operation(summary = "Is this handle free? (public, no auth)",
            description = "Asked from the sign-up form, before the account it would belong to "
                    + "exists — which is why it can't require a token. Answers the shape rules "
                    + "too, so the form can say WHY rather than just refusing. Availability is "
                    + "advisory: the claim is settled when the profile row is written.")
    public Map<String, Object> usernameAvailable(@PathVariable String username) {
        // Deliberately NOT cached, unlike every other read here. It is a liveness question asked
        // mid-sign-up, and a stale "taken" is the worst possible answer — this check has already
        // once reported somebody their own handle was taken. Left to inherit the app's default
        // no-store.
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
    public ResponseEntity<PublicDeckPage> discover(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Integer minCards,
            @RequestParam(required = false) Integer maxCards,
            @RequestParam(defaultValue = "12") int limit,
            @RequestParam(defaultValue = "0") int offset,
            @RequestParam(required = false) String sort
    ) {
        return ResponseEntity.ok()
                .cacheControl(PUBLIC_READ)
                .body(deckService.getPublicDecks(q, minCards, maxCards, limit, offset, sort));
    }
}
