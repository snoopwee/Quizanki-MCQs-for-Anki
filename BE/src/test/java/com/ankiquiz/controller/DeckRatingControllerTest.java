package com.ankiquiz.controller;

import com.ankiquiz.dto.request.DeckRatingRequest;
import com.ankiquiz.dto.response.DeckRatingResponse;
import com.ankiquiz.exception.ConflictException;
import com.ankiquiz.exception.GlobalExceptionHandler;
import com.ankiquiz.exception.NotFoundException;
import com.ankiquiz.service.DeckRatingService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(DeckRatingController.class)
@Import(GlobalExceptionHandler.class)
class DeckRatingControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private DeckRatingService deckRatingService;

    @MockBean
    private JwtDecoder jwtDecoder;

    private final UUID deckId = UUID.randomUUID();

    private String body(Integer stars, String note) throws Exception {
        return objectMapper.writeValueAsString(new DeckRatingRequest(stars, note));
    }

    @Test
    void returnsTheScoreAndTheCallersOwnRating() throws Exception {
        when(deckRatingService.get("user-1", deckId))
                .thenReturn(new DeckRatingResponse(17, 4.2, 4, "Mine, for the author."));

        mockMvc.perform(get("/api/v1/decks/{deckId}/rating", deckId)
                        .with(jwt().jwt(j -> j.subject("user-1"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(17))
                .andExpect(jsonPath("$.average").value(4.2))
                .andExpect(jsonPath("$.myStars").value(4))
                .andExpect(jsonPath("$.myNote").value("Mine, for the author."));
    }

    @Test
    void ratingGoesThroughWithItsNote() throws Exception {
        when(deckRatingService.rate(eq("user-1"), eq(deckId), anyInt(), any()))
                .thenReturn(new DeckRatingResponse(1, 5.0, 5, "Excellent."));

        mockMvc.perform(put("/api/v1/decks/{deckId}/rating", deckId)
                        .with(jwt().jwt(j -> j.subject("user-1")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(5, "Excellent.")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.myStars").value(5));

        verify(deckRatingService).rate("user-1", deckId, 5, "Excellent.");
    }

    @Test
    void starsOutsideOneToFiveAreRejectedByValidation() throws Exception {
        for (Integer stars : new Integer[]{0, 6, null}) {
            mockMvc.perform(put("/api/v1/decks/{deckId}/rating", deckId)
                            .with(jwt().jwt(j -> j.subject("user-1")))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(body(stars, null)))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.details.stars").exists());
        }

        verify(deckRatingService, never()).rate(any(), any(), anyInt(), any());
    }

    @Test
    void anOverlongNoteIsRejectedRatherThanSilentlyClipped() throws Exception {
        mockMvc.perform(put("/api/v1/decks/{deckId}/rating", deckId)
                        .with(jwt().jwt(j -> j.subject("user-1")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(4, "n".repeat(1001))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.details.note").exists());

        verify(deckRatingService, never()).rate(any(), any(), anyInt(), any());
    }

    @Test
    void ratingYourOwnDeckIs409WithAReadableMessage() throws Exception {
        when(deckRatingService.rate(any(), any(), anyInt(), any()))
                .thenThrow(new ConflictException("You can't rate your own deck."));

        mockMvc.perform(put("/api/v1/decks/{deckId}/rating", deckId)
                        .with(jwt().jwt(j -> j.subject("author-9")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(5, null)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("You can't rate your own deck."));
    }

    @Test
    void aDeckYouCannotOpenIs404() throws Exception {
        when(deckRatingService.get(any(), any())).thenThrow(new NotFoundException("Deck not found"));

        mockMvc.perform(get("/api/v1/decks/{deckId}/rating", deckId)
                        .with(jwt().jwt(j -> j.subject("user-1"))))
                .andExpect(status().isNotFound());
    }

    @Test
    void takingBackARatingReturnsTheScoreWithoutIt() throws Exception {
        when(deckRatingService.remove("user-1", deckId))
                .thenReturn(new DeckRatingResponse(16, 4.1, null, null));

        mockMvc.perform(delete("/api/v1/decks/{deckId}/rating", deckId)
                        .with(jwt().jwt(j -> j.subject("user-1"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(16))
                .andExpect(jsonPath("$.myStars").doesNotExist());
    }

    @Test
    void ratingNeedsAnAccount() throws Exception {
        mockMvc.perform(get("/api/v1/decks/{deckId}/rating", deckId))
                .andExpect(status().isUnauthorized());
        // csrf() because a @WebMvcTest slice doesn't load SecurityConfig (which disables CSRF), so
        // these would otherwise be refused as 403 before authentication is reached.
        mockMvc.perform(put("/api/v1/decks/{deckId}/rating", deckId)
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(5, null)))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(delete("/api/v1/decks/{deckId}/rating", deckId).with(csrf()))
                .andExpect(status().isUnauthorized());

        verify(deckRatingService, never()).rate(any(), any(), anyInt(), any());
        verify(deckRatingService, never()).remove(any(), any());
    }
}
