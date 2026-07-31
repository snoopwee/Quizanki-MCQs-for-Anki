package com.ankiquiz.controller;

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

import java.util.UUID;

import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ReportController.class)
@Import(GlobalExceptionHandler.class)
class ReportControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private ReportService reportService;

    @MockBean
    private JwtDecoder jwtDecoder;

    @Test
    void report_returns202_andDelegatesWithReporterFromJwt() throws Exception {
        UUID deckId = UUID.randomUUID();

        mockMvc.perform(post("/api/v1/decks/{deckId}/report", deckId)
                        .with(jwt().jwt(j -> j.subject("user-1")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"Spam\",\"details\":\"looks off\"}"))
                .andExpect(status().isAccepted());

        verify(reportService).report("user-1", deckId, "Spam", "looks off");
    }
}
