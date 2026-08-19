package com.ankiquiz.controller;

import com.ankiquiz.config.AdminAccess;
import com.ankiquiz.config.SecurityConfig;
import com.ankiquiz.dto.response.SiteConfigResponse;
import com.ankiquiz.exception.GlobalExceptionHandler;
import com.ankiquiz.service.SiteConfigService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Imports the real {@link SecurityConfig} to confirm the live-config read is
 * genuinely public — every client (guest included) fetches it on load, so it must
 * not require a JWT.
 */
@WebMvcTest(ConfigController.class)
@Import({SecurityConfig.class, AdminAccess.class, GlobalExceptionHandler.class})
@TestPropertySource(properties = {
        "supabase.url=https://example.supabase.co",
        "app.cors.allowed-origins=http://localhost:3000",
})
class ConfigControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private SiteConfigService siteConfigService;

    @Test
    void publicConfig_isReachableWithoutAuth() throws Exception {
        when(siteConfigService.getConfig())
                .thenReturn(new SiteConfigResponse(false, null, "Welcome to Quizanki"));

        mockMvc.perform(get("/api/v1/public/config"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.maintenanceMode").value(false))
                .andExpect(jsonPath("$.announcement").value("Welcome to Quizanki"));
    }
}
