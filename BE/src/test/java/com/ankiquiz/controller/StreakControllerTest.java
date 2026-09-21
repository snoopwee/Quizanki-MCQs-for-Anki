package com.ankiquiz.controller;

import com.ankiquiz.dto.response.StreakResponse;
import com.ankiquiz.exception.GlobalExceptionHandler;
import com.ankiquiz.service.StreakService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(StreakController.class)
@Import(GlobalExceptionHandler.class)
class StreakControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private StreakService streakService;

    @MockBean
    private JwtDecoder jwtDecoder;

    @Test
    void getStreak_isComputedInTheCallersZone() throws Exception {
        when(streakService.getStreak(eq("user-1"), eq(ZoneId.of("Asia/Ho_Chi_Minh"))))
                .thenReturn(new StreakResponse(3, 5, true,
                        List.of(new StreakResponse.Day(LocalDate.of(2026, 9, 14), true))));

        mockMvc.perform(get("/api/v1/me/streak").param("tz", "Asia/Ho_Chi_Minh")
                        .with(jwt().jwt(j -> j.subject("user-1"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.current").value(3))
                .andExpect(jsonPath("$.longest").value(5))
                .andExpect(jsonPath("$.studiedToday").value(true))
                .andExpect(jsonPath("$.last7Days[0].date").value("2026-09-14"))
                .andExpect(jsonPath("$.last7Days[0].studied").value(true));
    }

    @Test
    void getStreak_fallsBackToUtc_forAnUnknownOrMissingZone() throws Exception {
        when(streakService.getStreak(eq("user-1"), any()))
                .thenReturn(new StreakResponse(0, 0, false, List.of()));

        mockMvc.perform(get("/api/v1/me/streak").param("tz", "Mars/Olympus_Mons")
                        .with(jwt().jwt(j -> j.subject("user-1"))))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/me/streak")
                        .with(jwt().jwt(j -> j.subject("user-1"))))
                .andExpect(status().isOk());

        verify(streakService, times(2)).getStreak("user-1", ZoneOffset.UTC);
    }

    @Test
    void getStreak_requiresAuthentication() throws Exception {
        mockMvc.perform(get("/api/v1/me/streak"))
                .andExpect(status().isUnauthorized());
    }

}
