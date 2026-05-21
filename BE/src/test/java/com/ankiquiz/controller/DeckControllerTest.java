package com.ankiquiz.controller;

import com.ankiquiz.dto.request.ImportDeckRequest;
import com.ankiquiz.dto.request.NoteRequest;
import com.ankiquiz.dto.response.DeckResponse;
import com.ankiquiz.exception.GlobalExceptionHandler;
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

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(DeckController.class)
@Import(GlobalExceptionHandler.class)
class DeckControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private DeckService deckService;

    @MockBean
    private JwtDecoder jwtDecoder;

    @Test
    void importDeck_returns201_withDeckResponse() throws Exception {
        UUID deckId = UUID.randomUUID();
        DeckResponse response = new DeckResponse(
                deckId, "JLPT N4", "Japanese::N4", "Front", "Back",
                0.91, 1, OffsetDateTime.now()
        );
        when(deckService.importDeck(eq("user-123"), any())).thenReturn(response);

        ImportDeckRequest request = new ImportDeckRequest(
                "JLPT N4", "Japanese::N4", "Front", "Back", 0.91,
                List.of(new NoteRequest(
                        "1234567890",
                        Map.of("Front", "食べる", "Back", "to eat"),
                        List.of("N4", "verb")
                ))
        );

        mockMvc.perform(post("/api/v1/decks")
                        .with(jwt().jwt(j -> j.subject("user-123")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(deckId.toString()))
                .andExpect(jsonPath("$.name").value("JLPT N4"))
                .andExpect(jsonPath("$.cardCount").value(1));
    }

    @Test
    void importDeck_returns400_whenNameBlank() throws Exception {
        ImportDeckRequest request = new ImportDeckRequest(
                "", null, "Front", "Back", 0.5,
                List.of(new NoteRequest("1", Map.of("Front", "a", "Back", "b"), List.of()))
        );

        mockMvc.perform(post("/api/v1/decks")
                        .with(jwt().jwt(j -> j.subject("user-123")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.details.name").exists());
    }

    @Test
    void importDeck_returns400_whenNotesEmpty() throws Exception {
        ImportDeckRequest request = new ImportDeckRequest(
                "deck", null, "Front", "Back", 0.5, List.of()
        );

        mockMvc.perform(post("/api/v1/decks")
                        .with(jwt().jwt(j -> j.subject("user-123")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.details.notes").exists());
    }
}
