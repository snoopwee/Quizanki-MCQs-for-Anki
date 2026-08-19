package com.ankiquiz.controller;

import com.ankiquiz.config.AdminAccess;
import com.ankiquiz.config.SecurityConfig;
import com.ankiquiz.service.AdminService;
import com.ankiquiz.service.DeckService;
import com.ankiquiz.service.SiteConfigService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The admin gate is a security boundary, so it's tested through the real
 * {@link SecurityConfig} filter chain rather than a mocked slice. ROLE_ADMIN is
 * what the /api/v1/admin/** matcher requires; that role is only ever granted to an
 * allowlisted subject (proven separately in {@code AdminAccessTest}). Here we prove
 * the matcher enforces it: no role → 403, role present → through.
 */
@WebMvcTest(AdminController.class)
@Import({SecurityConfig.class, AdminAccess.class})
@TestPropertySource(properties = {
        "supabase.url=https://example.supabase.co",
        "app.cors.allowed-origins=http://localhost:3000",
        "app.admin.user-ids=admin-1",
})
class AdminControllerSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private DeckService deckService;

    @MockBean
    private AdminService adminService;

    @MockBean
    private SiteConfigService siteConfigService;

    @Test
    void adminEndpoint_rejectsUnauthenticated_with401() throws Exception {
        mockMvc.perform(get("/api/v1/admin/whoami"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void adminEndpoint_rejectsAuthenticatedNonAdmin_with403() throws Exception {
        mockMvc.perform(get("/api/v1/admin/whoami")
                        .with(jwt().jwt(j -> j.subject("user-1"))))
                .andExpect(status().isForbidden());
    }

    @Test
    void adminEndpoint_allowsAdmin_with200() throws Exception {
        mockMvc.perform(get("/api/v1/admin/whoami")
                        .with(jwt().jwt(j -> j.subject("admin-1"))
                                .authorities(new SimpleGrantedAuthority("ROLE_ADMIN"))))
                .andExpect(status().isOk());
    }
}
