package com.ankiquiz.controller;

import com.ankiquiz.dto.response.DeckHistoryPoint;
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

import java.util.List;
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

    @Test
    void getHistory_returns200_withPerTestPoints() throws Exception {
        UUID deckId = UUID.randomUUID();
        when(statsService.getDeckHistory(eq("user-1"), eq(deckId), eq(30)))
                .thenReturn(List.of(
                        new DeckHistoryPoint(1_752_000_000_000L, 10, 7, 0.7),
                        new DeckHistoryPoint(1_752_003_600_000L, 8, 8, 1.0)));

        mockMvc.perform(get("/api/v1/decks/{deckId}/stats/history", deckId)
                        .with(jwt().jwt(j -> j.subject("user-1"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].at").value(1_752_000_000_000L))
                .andExpect(jsonPath("$[0].answered").value(10))
                .andExpect(jsonPath("$[0].correct").value(7))
                .andExpect(jsonPath("$[0].accuracy").value(0.7))
                .andExpect(jsonPath("$[1].accuracy").value(1.0));
    }

    @Test
    void getHistory_passesDaysParam_toService() throws Exception {
        UUID deckId = UUID.randomUUID();
        when(statsService.getDeckHistory(eq("user-1"), eq(deckId), eq(7)))
                .thenReturn(List.of());

        mockMvc.perform(get("/api/v1/decks/{deckId}/stats/history", deckId)
                        .param("days", "7")
                        .with(jwt().jwt(j -> j.subject("user-1"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }
}
