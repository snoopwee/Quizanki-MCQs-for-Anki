package com.ankiquiz.controller;

import com.ankiquiz.config.SecurityConfig;
import com.ankiquiz.dto.response.ApkgNotesResponse;
import com.ankiquiz.exception.ApkgParseException;
import com.ankiquiz.exception.GlobalExceptionHandler;
import com.ankiquiz.service.ApkgParserService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Imports the real {@link SecurityConfig} so we can assert the parse endpoint is
 * genuinely public — reachable without a JWT — which is the whole point of the
 * guest "try-before-signup" flow.
 */
@WebMvcTest(ApkgParseController.class)
@Import({SecurityConfig.class, GlobalExceptionHandler.class})
@TestPropertySource(properties = {
        "supabase.url=https://example.supabase.co",
        "app.cors.allowed-origins=http://localhost:3000"
})
class ApkgParseControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private ApkgParserService parserService;

    @Test
    void parseApkg_isReachableWithoutAuth_andReturnsParsedResponse() throws Exception {
        when(parserService.parseNotes(any())).thenReturn(
                new ApkgNotesResponse("deck.apkg", "collection.anki2", "legacy", 0, 0, 0, List.of()));

        MockMultipartFile file =
                new MockMultipartFile("file", "deck.apkg", "application/octet-stream", new byte[]{1, 2, 3});

        // No .with(jwt(...)) — confirms the public whitelist works.
        mockMvc.perform(multipart("/api/v1/public/parse-apkg").file(file))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.filename").value("deck.apkg"))
                .andExpect(jsonPath("$.collectionFile").value("collection.anki2"));
    }

    @Test
    void parseApkg_returns400_whenServiceRejectsTheFile() throws Exception {
        when(parserService.parseNotes(any()))
                .thenThrow(new ApkgParseException("Only .apkg files are accepted."));

        MockMultipartFile file =
                new MockMultipartFile("file", "notes.txt", "text/plain", new byte[]{1});

        mockMvc.perform(multipart("/api/v1/public/parse-apkg").file(file))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Only .apkg files are accepted."));
    }
}
