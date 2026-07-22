package com.ankiquiz.controller;

import com.ankiquiz.dto.request.RecordAnswerRequest;
import com.ankiquiz.dto.request.StartSessionRequest;
import com.ankiquiz.dto.response.RecordAnswerResponse;
import com.ankiquiz.dto.response.StartSessionResponse;
import com.ankiquiz.exception.GlobalExceptionHandler;
import com.ankiquiz.service.SessionService;
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
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(SessionController.class)
@Import(GlobalExceptionHandler.class)
class SessionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private SessionService sessionService;

    @MockBean
    private JwtDecoder jwtDecoder;

    @Test
    void startSession_returns201_withSessionId() throws Exception {
        UUID sessionId = UUID.randomUUID();
        when(sessionService.startSession(eq("user-1"), any()))
                .thenReturn(new StartSessionResponse(sessionId));

        StartSessionRequest request = new StartSessionRequest(UUID.randomUUID(), 10, "FRONT_TO_BACK");

        mockMvc.perform(post("/api/v1/sessions")
                        .with(jwt().jwt(j -> j.subject("user-1")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.sessionId").value(sessionId.toString()));
    }

    @Test
    void startSession_returns400_whenDeckIdMissing() throws Exception {
        StartSessionRequest request = new StartSessionRequest(null, 10, "FRONT_TO_BACK");

        mockMvc.perform(post("/api/v1/sessions")
                        .with(jwt().jwt(j -> j.subject("user-1")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.details.deckId").exists());
    }

    @Test
    void recordAnswer_returns200_withUpdatedStats() throws Exception {
        UUID sessionId = UUID.randomUUID();
        when(sessionService.recordAnswer(eq("user-1"), any(), any()))
                .thenReturn(new RecordAnswerResponse(0.75, 3, 60.0));

        RecordAnswerRequest request = new RecordAnswerRequest(UUID.randomUUID(), true);

        mockMvc.perform(post("/api/v1/sessions/{sessionId}/answers", sessionId)
                        .with(jwt().jwt(j -> j.subject("user-1")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accuracy").value(0.75))
                .andExpect(jsonPath("$.streak").value(3))
                .andExpect(jsonPath("$.mastery").value(60.0));
    }
}
