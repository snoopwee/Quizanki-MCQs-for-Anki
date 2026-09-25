package com.ankiquiz.controller;

import com.ankiquiz.dto.request.TakedownRequest;
import com.ankiquiz.dto.request.UpdateReportRequest;
import com.ankiquiz.dto.response.AdminReviewReportResponse;
import com.ankiquiz.exception.GlobalExceptionHandler;
import com.ankiquiz.exception.NotFoundException;
import com.ankiquiz.service.ReviewReportService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.web.servlet.MockMvc;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AdminReviewReportController.class)
@Import(GlobalExceptionHandler.class)
class AdminReviewReportControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private ReviewReportService reviewReportService;

    @MockBean
    private JwtDecoder jwtDecoder;

    private final UUID reportId = UUID.randomUUID();
    private final UUID deckId = UUID.randomUUID();

    @Test
    void listsReportedNotesWithTheirSnapshot() throws Exception {
        when(reviewReportService.list("open", null)).thenReturn(List.of(new AdminReviewReportResponse(
                reportId, deckId, "JLPT N3 kanji", "author-9", "Abusive", null,
                "this deck is rubbish and so are you", "rater-2", "Troublesome Tim", true, "open", null,
                OffsetDateTime.parse("2026-09-23T09:00:00Z"))));

        mockMvc.perform(get("/api/v1/admin/review-reports").param("status", "open")
                        .with(jwt().jwt(j -> j.subject("admin-1"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].noteSnapshot").value("this deck is rubbish and so are you"))
                .andExpect(jsonPath("$[0].deckName").value("JLPT N3 kanji"))
                .andExpect(jsonPath("$[0].ratingStillThere").value(true))
                // Admin-only: the account behind the note, so the ban flow is reachable from here.
                .andExpect(jsonPath("$[0].writerId").value("rater-2"))
                .andExpect(jsonPath("$[0].writerName").value("Troublesome Tim"));
    }

    @Test
    void resolvingPassesTheAdminAndTheirReasonThrough() throws Exception {
        mockMvc.perform(put("/api/v1/admin/review-reports/{id}", reportId)
                        .with(jwt().jwt(j -> j.subject("admin-1")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new UpdateReportRequest("resolved", "Clear personal attack."))))
                .andExpect(status().isNoContent());

        verify(reviewReportService).updateStatus(reportId, "resolved", "admin-1",
                "Clear personal attack.");
    }

    @Test
    void aBlankStatusIsRejectedByValidation() throws Exception {
        mockMvc.perform(put("/api/v1/admin/review-reports/{id}", reportId)
                        .with(jwt().jwt(j -> j.subject("admin-1")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new UpdateReportRequest("  ", "why"))))
                .andExpect(status().isBadRequest());

        verify(reviewReportService, never()).updateStatus(any(), any(), any(), any());
    }

    @Test
    void anActionWithNoReasonIsRejected() throws Exception {
        // The report row is deleted after fifteen days, so an unexplained decision leaves nothing
        // behind at all. Refused before it reaches the service.
        mockMvc.perform(put("/api/v1/admin/review-reports/{id}", reportId)
                        .with(jwt().jwt(j -> j.subject("admin-1")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new UpdateReportRequest("resolved", "  "))))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/v1/admin/review-reports/{id}/takedown", reportId).with(csrf())
                        .with(jwt().jwt(j -> j.subject("admin-1")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new TakedownRequest(""))))
                .andExpect(status().isBadRequest());

        verify(reviewReportService, never()).updateStatus(any(), any(), any(), any());
        verify(reviewReportService, never()).takeDownRating(any(), any());
    }

    @Test
    void anUnknownReportIs404() throws Exception {
        when(reviewReportService.takeDownRating(any(), any()))
                .thenThrow(new NotFoundException("Report not found"));

        mockMvc.perform(post("/api/v1/admin/review-reports/{id}/takedown", reportId).with(csrf())
                        .with(jwt().jwt(j -> j.subject("admin-1")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new TakedownRequest("Abusive."))))
                .andExpect(status().isNotFound());
    }

    @Test
    void takingTheRatingDownReturns204_andCarriesTheReason() throws Exception {
        mockMvc.perform(post("/api/v1/admin/review-reports/{id}/takedown", reportId).with(csrf())
                        .with(jwt().jwt(j -> j.subject("admin-1")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new TakedownRequest("Personal abuse, not feedback."))))
                .andExpect(status().isNoContent());

        // The reason is sent on to the person whose rating this was.
        verify(reviewReportService).takeDownRating(reportId, "Personal abuse, not feedback.");
    }

    @Test
    void bothRoutesNeedAuthentication() throws Exception {
        mockMvc.perform(get("/api/v1/admin/review-reports")).andExpect(status().isUnauthorized());
        // csrf() because a @WebMvcTest slice doesn't load SecurityConfig (which disables CSRF), so
        // these would otherwise be refused as 403 before authentication is reached.
        mockMvc.perform(post("/api/v1/admin/review-reports/{id}/takedown", reportId).with(csrf()))
                .andExpect(status().isUnauthorized());

        verify(reviewReportService, never()).list(any(), any());
        verify(reviewReportService, never()).takeDownRating(any(), any());
    }
}
