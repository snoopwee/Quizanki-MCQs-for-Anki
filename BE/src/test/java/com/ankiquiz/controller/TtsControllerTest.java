package com.ankiquiz.controller;

import com.ankiquiz.config.SecurityConfig;
import com.ankiquiz.dto.response.TtsResponse;
import com.ankiquiz.exception.GlobalExceptionHandler;
import com.ankiquiz.exception.TtsUnavailableException;
import com.ankiquiz.service.TtsRateLimiter;
import com.ankiquiz.service.TtsService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.containsString;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Imports the real {@link SecurityConfig} to confirm the TTS endpoint is public
 * (guests use the speaker too), and exercises the status mapping for the disabled
 * and rate-limited cases.
 */
@WebMvcTest(TtsController.class)
@Import({SecurityConfig.class, GlobalExceptionHandler.class})
@TestPropertySource(properties = {
        "supabase.url=https://example.supabase.co",
        "app.cors.allowed-origins=http://localhost:3000"
})
class TtsControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private TtsService ttsService;

    @MockBean
    private TtsRateLimiter rateLimiter;

    @Test
    void synthesize_isPublic_andReturnsAudioUrl() throws Exception {
        when(rateLimiter.tryAcquire(any())).thenReturn(true);
        when(ttsService.synthesizeToUrl(any(), any())).thenReturn(
                new TtsResponse("https://example.supabase.co/storage/v1/object/public/tts-cache/vi/abc.mp3"));

        // No auth — confirms the public whitelist works.
        mockMvc.perform(post("/api/v1/public/tts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"text\":\"xin chao\",\"lang\":\"vi\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.url").value(containsString("/tts-cache/vi/")));
    }

    @Test
    void synthesize_returns400_whenTextIsBlank() throws Exception {
        mockMvc.perform(post("/api/v1/public/tts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"text\":\"\",\"lang\":\"vi\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void synthesize_returns503_whenCloudTtsNotConfigured() throws Exception {
        when(rateLimiter.tryAcquire(any())).thenReturn(true);
        when(ttsService.synthesizeToUrl(any(), any()))
                .thenThrow(new TtsUnavailableException("Cloud text-to-speech is not configured."));

        mockMvc.perform(post("/api/v1/public/tts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"text\":\"hello\",\"lang\":\"vi\"}"))
                .andExpect(status().isServiceUnavailable());
    }

    @Test
    void synthesize_returns429_whenRateLimited() throws Exception {
        when(rateLimiter.tryAcquire(any())).thenReturn(false);

        mockMvc.perform(post("/api/v1/public/tts")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"text\":\"hello\",\"lang\":\"vi\"}"))
                .andExpect(status().isTooManyRequests());
    }
}
