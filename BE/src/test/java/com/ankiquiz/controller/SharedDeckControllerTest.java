package com.ankiquiz.controller;

import com.ankiquiz.config.SecurityConfig;
import com.ankiquiz.dto.response.AuthorPageResponse;
import com.ankiquiz.dto.response.DeckContentsResponse;
import com.ankiquiz.dto.response.PublicDeckPage;
import com.ankiquiz.dto.response.PublicDeckSummary;
import com.ankiquiz.exception.GlobalExceptionHandler;
import com.ankiquiz.exception.NotFoundException;
import com.ankiquiz.service.DeckService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Imports the real {@link SecurityConfig} so we can assert a shared deck is
 * genuinely readable without a JWT — that's what makes a share link work for a
 * logged-out visitor.
 */
@WebMvcTest(SharedDeckController.class)
@Import({SecurityConfig.class, GlobalExceptionHandler.class})
@TestPropertySource(properties = {
        "supabase.url=https://example.supabase.co",
        "app.cors.allowed-origins=http://localhost:3000"
})
class SharedDeckControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private DeckService deckService;

    @Test
    void getSharedDeck_isReachableWithoutAuth() throws Exception {
        UUID deckId = UUID.randomUUID();
        DeckContentsResponse contents = new DeckContentsResponse(
                deckId, "JLPT N4", null, "n4.apkg", 12, OffsetDateTime.now(), 0.0, "ja", "en",
                true, "user-1", "Alice", null, null, false, false, List.of());
        when(deckService.getPublicDeckContents(eq(deckId))).thenReturn(contents);

        // No .with(jwt(...)) — confirms the public whitelist covers shared decks.
        mockMvc.perform(get("/api/v1/public/shared/{deckId}", deckId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("JLPT N4"))
                .andExpect(jsonPath("$.cardCount").value(12))
                .andExpect(jsonPath("$.isPublic").value(true));
    }

    @Test
    void getSharedDeck_returns404_whenDeckIsNotShared() throws Exception {
        UUID deckId = UUID.randomUUID();
        when(deckService.getPublicDeckContents(eq(deckId)))
                .thenThrow(new NotFoundException("Shared deck not found: " + deckId));

        mockMvc.perform(get("/api/v1/public/shared/{deckId}", deckId))
                .andExpect(status().isNotFound());
    }

    @Test
    void discover_isReachableWithoutAuth_andReturnsAPage() throws Exception {
        UUID deckId = UUID.randomUUID();
        PublicDeckPage page = new PublicDeckPage(
                List.of(new PublicDeckSummary(deckId, "JLPT N4", 120, "author-1", "Alice", null, null, OffsetDateTime.now())),
                0, 12, 1, 1);
        when(deckService.getPublicDecks(eq("jlpt"), eq(20), eq(50), eq(12), eq(0))).thenReturn(page);

        // Browsing Discover is open to guests — only copying a deck needs an account.
        mockMvc.perform(get("/api/v1/public/discover")
                        .param("q", "jlpt").param("minCards", "20").param("maxCards", "50"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.totalPages").value(1))
                .andExpect(jsonPath("$.items[0].id").value(deckId.toString()))
                .andExpect(jsonPath("$.items[0].authorName").value("Alice"));
    }

    @Test
    void getAuthor_isReachableWithoutAuth_andListsTheAuthorsPublicDecks() throws Exception {
        UUID deckId = UUID.randomUUID();
        AuthorPageResponse page = new AuthorPageResponse("author-1", "Alice", null, 1,
                List.of(new PublicDeckSummary(deckId, "JLPT N4", 120, "author-1", "Alice", null, null,
                        OffsetDateTime.now())));
        when(deckService.getAuthorPage(eq("author-1"))).thenReturn(page);

        mockMvc.perform(get("/api/v1/public/authors/{authorId}", "author-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.authorName").value("Alice"))
                .andExpect(jsonPath("$.deckCount").value(1))
                .andExpect(jsonPath("$.decks[0].id").value(deckId.toString()))
                .andExpect(jsonPath("$.decks[0].authorId").value("author-1"));
    }

    @Test
    void discover_defaultsPagingAndOmitsFiltersWhenNoParamsAreGiven() throws Exception {
        when(deckService.getPublicDecks(isNull(), isNull(), isNull(), eq(12), eq(0)))
                .thenReturn(new PublicDeckPage(List.of(), 0, 12, 0, 0));

        mockMvc.perform(get("/api/v1/public/discover"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isArray())
                .andExpect(jsonPath("$.total").value(0));
    }
}
