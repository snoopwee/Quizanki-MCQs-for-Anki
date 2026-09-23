package com.ankiquiz.controller;

import com.ankiquiz.config.AdminAccess;
import com.ankiquiz.dto.request.AuthorProfileRequest;
import com.ankiquiz.exception.GlobalExceptionHandler;
import com.ankiquiz.service.Caller;
import com.ankiquiz.service.DeckService;
import com.ankiquiz.service.ProfileService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ProfileController.class)
@Import(GlobalExceptionHandler.class)
class ProfileControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private DeckService deckService;

    @MockBean
    private AdminAccess adminAccess;

    @MockBean
    private ProfileService profileService;

    @MockBean
    private JwtDecoder jwtDecoder;

    // Same as elsewhere: a bare test JWT resolves to (subject, Anonymous, no avatar).
    private static final Caller CALLER = new Caller("user-123", Caller.ANONYMOUS, null);

    @Test
    void me_reportsIdentityAndAdminFlag() throws Exception {
        when(adminAccess.isAdmin("user-123", "a@b.com")).thenReturn(true);

        mockMvc.perform(get("/api/v1/me")
                        .with(jwt().jwt(j -> j.subject("user-123").claim("email", "a@b.com"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value("user-123"))
                .andExpect(jsonPath("$.email").value("a@b.com"))
                .andExpect(jsonPath("$.isAdmin").value(true));
    }

    @Test
    void syncAuthorProfile_returns200_withTheUpdatedCount() throws Exception {
        Caller renamed = CALLER.withOverrides("Alice Renamed", "https://cdn/a.png");
        when(deckService.syncAuthorProfile(eq(renamed))).thenReturn(4);

        mockMvc.perform(put("/api/v1/me/author-profile")
                        .with(jwt().jwt(j -> j.subject("user-123")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(
                                new AuthorProfileRequest("Alice Renamed", "https://cdn/a.png"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.updated").value(4));

        // The bug this closes: the author page reads the PROFILE row, and GET /me can only write
        // it from the token — which is still a rename behind. So it has to be written here, from
        // the values the profile page just sent.
        verify(profileService).remember(renamed);
    }

    @Test
    void syncAuthorProfile_toleratesAnEmptyBody() throws Exception {
        when(deckService.syncAuthorProfile(eq(CALLER))).thenReturn(0);

        mockMvc.perform(put("/api/v1/me/author-profile")
                        .with(jwt().jwt(j -> j.subject("user-123"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.updated").value(0));
    }
}
