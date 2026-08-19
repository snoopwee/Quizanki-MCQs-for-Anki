package com.ankiquiz.controller;

import com.ankiquiz.dto.response.AdminStatsResponse;
import com.ankiquiz.dto.response.PublicDeckPage;
import com.ankiquiz.dto.response.PublicDeckSummary;
import com.ankiquiz.dto.response.SiteConfigResponse;
import com.ankiquiz.exception.GlobalExceptionHandler;
import com.ankiquiz.exception.NotFoundException;
import com.ankiquiz.service.AdminService;
import com.ankiquiz.service.DeckService;
import com.ankiquiz.service.SiteConfigService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.web.servlet.MockMvc;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The moderation endpoints' behaviour (the ROLE_ADMIN gate itself is proven in
 * {@link AdminControllerSecurityTest}). This slice mocks the service, so an
 * authenticated request is enough to reach the handler.
 */
@WebMvcTest(AdminController.class)
@Import(GlobalExceptionHandler.class)
class AdminControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private DeckService deckService;

    @MockBean
    private AdminService adminService;

    @MockBean
    private SiteConfigService siteConfigService;

    @MockBean
    private JwtDecoder jwtDecoder;

    @Test
    void updateConfig_savesAndReturnsTheSettings() throws Exception {
        when(siteConfigService.updateConfig(org.mockito.ArgumentMatchers.any()))
                .thenReturn(new SiteConfigResponse(true, "Back at 5pm", "Welcome!"));

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                        .put("/api/v1/admin/config")
                        .with(jwt().jwt(j -> j.subject("admin-1")))
                        .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                        .content("{\"maintenanceMode\":true,\"maintenanceMessage\":\"Back at 5pm\",\"announcement\":\"Welcome!\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.maintenanceMode").value(true))
                .andExpect(jsonPath("$.announcement").value("Welcome!"));
    }

    @Test
    void stats_returnsTheOverviewTotals() throws Exception {
        when(adminService.getStats())
                .thenReturn(new AdminStatsResponse(42, 12, 3800, 9, 15, 5000, 4, 120));

        mockMvc.perform(get("/api/v1/admin/stats")
                        .with(jwt().jwt(j -> j.subject("admin-1"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.decks").value(42))
                .andExpect(jsonPath("$.publicDecks").value(12))
                .andExpect(jsonPath("$.learners").value(15))
                .andExpect(jsonPath("$.answersLast7Days").value(120));
    }

    @Test
    void listDecks_returnsThePublicCatalogue() throws Exception {
        UUID deckId = UUID.randomUUID();
        PublicDeckPage page = new PublicDeckPage(
                List.of(new PublicDeckSummary(
                        deckId, "JLPT N4", 120, "author-1", "Alice", null, null, OffsetDateTime.now())),
                0, 20, 1, 1);
        when(deckService.getPublicDecks(eq("jlpt"), isNull(), isNull(), eq(20), eq(0))).thenReturn(page);

        mockMvc.perform(get("/api/v1/admin/decks").param("q", "jlpt")
                        .with(jwt().jwt(j -> j.subject("admin-1"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].name").value("JLPT N4"));
    }

    @Test
    void unpublishDeck_returns204_andDelegates() throws Exception {
        UUID deckId = UUID.randomUUID();

        mockMvc.perform(post("/api/v1/admin/decks/{id}/unpublish", deckId)
                        .with(jwt().jwt(j -> j.subject("admin-1"))))
                .andExpect(status().isNoContent());

        verify(deckService).adminUnpublishDeck(deckId);
    }

    @Test
    void deleteDeck_returns204_andDelegates() throws Exception {
        UUID deckId = UUID.randomUUID();

        mockMvc.perform(delete("/api/v1/admin/decks/{id}", deckId)
                        .with(jwt().jwt(j -> j.subject("admin-1"))))
                .andExpect(status().isNoContent());

        verify(deckService).adminDeleteDeck(deckId);
    }

    @Test
    void unpublishMissingDeck_returns404() throws Exception {
        UUID deckId = UUID.randomUUID();
        doThrow(new NotFoundException("Deck not found: " + deckId))
                .when(deckService).adminUnpublishDeck(deckId);

        mockMvc.perform(post("/api/v1/admin/decks/{id}/unpublish", deckId)
                        .with(jwt().jwt(j -> j.subject("admin-1"))))
                .andExpect(status().isNotFound());
    }
}
