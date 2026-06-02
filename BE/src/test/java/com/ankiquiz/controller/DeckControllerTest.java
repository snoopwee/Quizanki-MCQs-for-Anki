package com.ankiquiz.controller;

import com.ankiquiz.dto.request.ImportDeckRequest;
import com.ankiquiz.dto.request.NoteRequest;
import com.ankiquiz.dto.request.NoteTypeRequest;
import com.ankiquiz.dto.request.UpdateDeckRequest;
import com.ankiquiz.dto.response.DeckResponse;
import com.ankiquiz.exception.GlobalExceptionHandler;
import com.ankiquiz.exception.NotFoundException;
import com.ankiquiz.service.ApkgExportService;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
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
    private ApkgExportService apkgExportService;

    @MockBean
    private JwtDecoder jwtDecoder;

    private static NoteTypeRequest noteType(String name, NoteRequest... notes) {
        return new NoteTypeRequest(
                1234567890L, name, false,
                List.of("Front", "Back"), List.of("Front"), List.of("Back"),
                List.of(notes)
        );
    }

    @Test
    void importDeck_returns201_withDeckResponse() throws Exception {
        UUID deckId = UUID.randomUUID();
        DeckResponse response = new DeckResponse(
                deckId, "JLPT N4", "Japanese::N4", "n4.apkg", 1, OffsetDateTime.now(), 0.0
        );
        when(deckService.importDeck(eq("user-123"), any())).thenReturn(response);

        ImportDeckRequest request = new ImportDeckRequest(
                "JLPT N4", "Japanese::N4", "n4.apkg",
                List.of(noteType("Basic", new NoteRequest(
                        "1234567890",
                        Map.of("Front", "食べる", "Back", "to eat"),
                        List.of("N4", "verb")
                )))
        );

        mockMvc.perform(post("/api/v1/decks")
                        .with(jwt().jwt(j -> j.subject("user-123")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(deckId.toString()))
                .andExpect(jsonPath("$.name").value("JLPT N4"))
                .andExpect(jsonPath("$.cardCount").value(1))
                .andExpect(jsonPath("$.completion").value(0.0));
    }

    @Test
    void importDeck_returns400_whenNameBlank() throws Exception {
        ImportDeckRequest request = new ImportDeckRequest(
                "", null, "n4.apkg",
                List.of(noteType("Basic", new NoteRequest("1", Map.of("Front", "a", "Back", "b"), List.of())))
        );

        mockMvc.perform(post("/api/v1/decks")
                        .with(jwt().jwt(j -> j.subject("user-123")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.details.name").exists());
    }

    @Test
    void updateDeck_returns200_withRenamedDeck() throws Exception {
        UUID deckId = UUID.randomUUID();
        DeckResponse response = new DeckResponse(
                deckId, "JLPT N3", "Japanese::N4", "n4.apkg", 1, OffsetDateTime.now(), 42.0
        );
        when(deckService.renameDeck(eq("user-123"), eq(deckId), eq("JLPT N3"))).thenReturn(response);

        mockMvc.perform(patch("/api/v1/decks/{deckId}", deckId)
                        .with(jwt().jwt(j -> j.subject("user-123")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new UpdateDeckRequest("JLPT N3"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("JLPT N3"))
                .andExpect(jsonPath("$.completion").value(42.0));
    }

    @Test
    void updateDeck_returns400_whenNameBlank() throws Exception {
        mockMvc.perform(patch("/api/v1/decks/{deckId}", UUID.randomUUID())
                        .with(jwt().jwt(j -> j.subject("user-123")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new UpdateDeckRequest("  "))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.details.name").exists());
    }

    @Test
    void exportApkg_returns200_withAttachmentHeader() throws Exception {
        UUID deckId = UUID.randomUUID();
        byte[] pkg = {'P', 'K', 3, 4};
        when(apkgExportService.export(eq("user-123"), eq(deckId))).thenReturn(pkg);

        mockMvc.perform(get("/api/v1/decks/{deckId}/export.apkg", deckId)
                        .with(jwt().jwt(j -> j.subject("user-123"))))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", "attachment; filename=\"deck.apkg\""))
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_OCTET_STREAM));
    }

    @Test
    void exportApkg_returns404_whenDeckMissing() throws Exception {
        UUID deckId = UUID.randomUUID();
        when(apkgExportService.export(eq("user-123"), eq(deckId)))
                .thenThrow(new NotFoundException("Deck not found: " + deckId));

        mockMvc.perform(get("/api/v1/decks/{deckId}/export.apkg", deckId)
                        .with(jwt().jwt(j -> j.subject("user-123"))))
                .andExpect(status().isNotFound());
    }

    @Test
    void updateDeck_returns404_whenDeckMissingOrNotOwned() throws Exception {
        UUID deckId = UUID.randomUUID();
        when(deckService.renameDeck(eq("user-123"), eq(deckId), any()))
                .thenThrow(new NotFoundException("Deck not found: " + deckId));

        mockMvc.perform(patch("/api/v1/decks/{deckId}", deckId)
                        .with(jwt().jwt(j -> j.subject("user-123")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new UpdateDeckRequest("New name"))))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404));
    }

    @Test
    void importDeck_returns400_whenNoteTypesEmpty() throws Exception {
        ImportDeckRequest request = new ImportDeckRequest(
                "deck", null, "n4.apkg", List.of()
        );

        mockMvc.perform(post("/api/v1/decks")
                        .with(jwt().jwt(j -> j.subject("user-123")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.details.noteTypes").exists());
    }
}
