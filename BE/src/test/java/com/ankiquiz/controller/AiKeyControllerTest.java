package com.ankiquiz.controller;

import com.ankiquiz.dto.request.AiKeyRequest;
import com.ankiquiz.dto.response.AiKeyStatusResponse;
import com.ankiquiz.exception.AiKeyInvalidException;
import com.ankiquiz.exception.GlobalExceptionHandler;
import com.ankiquiz.service.ai.AiKeyService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
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

@WebMvcTest(AiKeyController.class)
@Import(GlobalExceptionHandler.class)
class AiKeyControllerTest {

    private static final String KEY = "AIzaSy-not-a-real-key-ab12";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private AiKeyService keyService;

    @MockBean
    private JwtDecoder jwtDecoder;

    @Test
    void storesAKeyAndAnswersWithOnlyAHint() throws Exception {
        when(keyService.save(eq("user-1"), eq("gemini"), eq(KEY)))
                .thenReturn(new AiKeyStatusResponse(true, true, "gemini", "ab12"));

        MvcResult result = mockMvc.perform(put("/api/v1/me/ai-key")
                        .with(jwt().jwt(j -> j.subject("user-1")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new AiKeyRequest("gemini", KEY))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.configured").value(true))
                .andExpect(jsonPath("$.hint").value("ab12"))
                .andReturn();

        // The response must not carry the key back out, in any field.
        assertThat(result.getResponse().getContentAsString()).doesNotContain(KEY);
    }

    @Test
    void reportsWhenNoKeyIsStored() throws Exception {
        when(keyService.status("user-1")).thenReturn(new AiKeyStatusResponse(true, false, null, null));

        mockMvc.perform(get("/api/v1/me/ai-key").with(jwt().jwt(j -> j.subject("user-1"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.supported").value(true))
                .andExpect(jsonPath("$.configured").value(false));
    }

    @Test
    void aKeyTheServiceRejectsIs400_notAServerError() throws Exception {
        when(keyService.save(any(), any(), any()))
                .thenThrow(new AiKeyInvalidException("That doesn't look like an API key."));

        mockMvc.perform(put("/api/v1/me/ai-key")
                        .with(jwt().jwt(j -> j.subject("user-1")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new AiKeyRequest("gemini", "short"))))
                .andExpect(status().isBadRequest());
    }

    @Test
    void anEmptyKeyIsRejectedByValidation() throws Exception {
        mockMvc.perform(put("/api/v1/me/ai-key")
                        .with(jwt().jwt(j -> j.subject("user-1")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new AiKeyRequest("gemini", " "))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.details.apiKey").exists());

        verify(keyService, never()).save(any(), any(), any());
    }

    @Test
    void forgetsTheKeyOnRequest() throws Exception {
        mockMvc.perform(delete("/api/v1/me/ai-key").with(jwt().jwt(j -> j.subject("user-1"))).with(csrf()))
                .andExpect(status().isNoContent());

        verify(keyService).delete("user-1");
    }

    @Test
    void everyKeyRouteNeedsAuthentication() throws Exception {
        mockMvc.perform(get("/api/v1/me/ai-key")).andExpect(status().isUnauthorized());
        mockMvc.perform(delete("/api/v1/me/ai-key").with(csrf())).andExpect(status().isUnauthorized());
        verify(keyService, never()).delete(any());
    }
}
