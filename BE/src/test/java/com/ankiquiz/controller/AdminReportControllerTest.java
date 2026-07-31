package com.ankiquiz.controller;

import com.ankiquiz.dto.response.AdminReportResponse;
import com.ankiquiz.exception.GlobalExceptionHandler;
import com.ankiquiz.service.ReportService;
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

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AdminReportController.class)
@Import(GlobalExceptionHandler.class)
class AdminReportControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private ReportService reportService;

    @MockBean
    private JwtDecoder jwtDecoder;

    @Test
    void list_returnsTheQueue() throws Exception {
        UUID reportId = UUID.randomUUID();
        UUID deckId = UUID.randomUUID();
        when(reportService.listReports(eq("open"))).thenReturn(List.of(new AdminReportResponse(
                reportId, deckId, "JLPT N4", "Alice", "user-9", "Spam", null, "open", OffsetDateTime.now())));

        mockMvc.perform(get("/api/v1/admin/reports").param("status", "open")
                        .with(jwt().jwt(j -> j.subject("admin-1"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].deckName").value("JLPT N4"))
                .andExpect(jsonPath("$[0].reason").value("Spam"));
    }

    @Test
    void update_resolvesAReport_withTheAdminFromJwt() throws Exception {
        UUID reportId = UUID.randomUUID();

        mockMvc.perform(put("/api/v1/admin/reports/{id}", reportId)
                        .with(jwt().jwt(j -> j.subject("admin-1")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"resolved\"}"))
                .andExpect(status().isNoContent());

        verify(reportService).updateStatus(reportId, "resolved", "admin-1");
    }
}
