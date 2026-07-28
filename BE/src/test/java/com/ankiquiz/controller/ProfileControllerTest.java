package com.ankiquiz.controller;

import com.ankiquiz.dto.request.AuthorNameRequest;
import com.ankiquiz.exception.GlobalExceptionHandler;
import com.ankiquiz.service.Caller;
import com.ankiquiz.service.DeckService;
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
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
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
    private JwtDecoder jwtDecoder;

    // Same as elsewhere: a bare test JWT resolves to (subject, Anonymous).
    private static final Caller CALLER = new Caller("user-123", Caller.ANONYMOUS);

    @Test
    void syncAuthorName_returns200_withTheUpdatedCount() throws Exception {
        when(deckService.syncAuthorName(eq(CALLER), eq("Alice Renamed"))).thenReturn(4);

        mockMvc.perform(put("/api/v1/me/author-name")
                        .with(jwt().jwt(j -> j.subject("user-123")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new AuthorNameRequest("Alice Renamed"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.updated").value(4));
    }

    @Test
    void syncAuthorName_toleratesAnEmptyBody() throws Exception {
        when(deckService.syncAuthorName(eq(CALLER), eq((String) null))).thenReturn(0);

        mockMvc.perform(put("/api/v1/me/author-name")
                        .with(jwt().jwt(j -> j.subject("user-123"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.updated").value(0));
    }
}
