package com.ankiquiz.controller;

import com.ankiquiz.dto.response.DeckStatsResponse;
import com.ankiquiz.exception.GlobalExceptionHandler;
import com.ankiquiz.service.StatsService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(StatsController.class)
@Import(GlobalExceptionHandler.class)
class StatsControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private StatsService statsService;

    @MockBean
    private JwtDecoder jwtDecoder;

    @Test
    void getStats_returns200_withCounts() throws Exception {
        UUID deckId = UUID.randomUUID();
        when(statsService.getDeckStats(eq("user-1"), eq(deckId)))
                .thenReturn(new DeckStatsResponse(250, 142, 0.74, 31, 58, 42.5));

        mockMvc.perform(get("/api/v1/decks/{deckId}/stats", deckId)
                        .with(jwt().jwt(j -> j.subject("user-1"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalCards").value(250))
                .andExpect(jsonPath("$.seenCards").value(142))
                .andExpect(jsonPath("$.averageAccuracy").value(0.74))
                .andExpect(jsonPath("$.weakCards").value(31))
                .andExpect(jsonPath("$.masteredCards").value(58))
                .andExpect(jsonPath("$.averageMastery").value(42.5));
    }
}
