package com.ankiquiz.controller;

import com.ankiquiz.dto.request.ImportDeckRequest;
import com.ankiquiz.dto.request.NoteRequest;
import com.ankiquiz.dto.request.NoteTypeRequest;
import com.ankiquiz.dto.request.SaveDeckRequest;
import com.ankiquiz.dto.request.SetDeckLanguagesRequest;
import com.ankiquiz.dto.request.ShareDeckRequest;
import com.ankiquiz.dto.request.UpdateDeckContentsRequest;
import com.ankiquiz.dto.request.UpdateDeckRequest;
import com.ankiquiz.dto.response.DeckContentsResponse;
import com.ankiquiz.dto.response.DeckResponse;
import com.ankiquiz.exception.ConflictException;
import com.ankiquiz.exception.GlobalExceptionHandler;
import com.ankiquiz.exception.NotFoundException;
import com.ankiquiz.service.ApkgExportService;
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

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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

    // What Caller.from() resolves a bare test JWT to: the subject, and — with no
    // email or user_metadata claim on it — the anonymous display name. Asserting
    // on this exact value keeps the controller→service hand-off pinned down.
    private static final Caller CALLER = new Caller("user-123", Caller.ANONYMOUS, null);
    private static final Caller OTHER_CALLER = new Caller("user-456", Caller.ANONYMOUS, null);

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
                deckId, "JLPT N4", "Japanese::N4", "n4.apkg", 1, OffsetDateTime.now(), 0.0, "ja", "en",
                true, "user-123", "Alice", null, null
        );
        when(deckService.importDeck(eq(CALLER), any())).thenReturn(response);

        ImportDeckRequest request = new ImportDeckRequest(
                "JLPT N4", "Japanese::N4", "n4.apkg", "ja", "en", true,
                List.of(noteType("Basic", new NoteRequest(
                        "1234567890",
                        Map.of("Front", "食べる", "Back", "to eat"),
                        List.of("N4", "verb"),
                        null, null
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
                .andExpect(jsonPath("$.completion").value(0.0))
                // The review screen's visibility choice and the credited author
                // are both part of the contract the FE reads back.
                .andExpect(jsonPath("$.isPublic").value(true))
                .andExpect(jsonPath("$.authorName").value("Alice"));
    }

    @Test
    void importDeck_returns400_whenNameBlank() throws Exception {
        ImportDeckRequest request = new ImportDeckRequest(
                "", null, "n4.apkg", null, null, true,
                List.of(noteType("Basic", new NoteRequest("1", Map.of("Front", "a", "Back", "b"), List.of(), null, null)))
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
                deckId, "JLPT N3", "Japanese::N4", "n4.apkg", 1, OffsetDateTime.now(), 42.0, null, null,
                false, "user-123", "Alice", null, null
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
    void replaceContents_returns200_withUpdatedContents() throws Exception {
        UUID deckId = UUID.randomUUID();
        DeckContentsResponse response = new DeckContentsResponse(
                deckId, "Renamed", null, null, 1, OffsetDateTime.now(), 0.0, null, null,
                false, "user-123", "Alice", null, null, true, false, List.of());
        when(deckService.replaceDeckContents(eq(CALLER), eq(deckId), any())).thenReturn(response);

        UpdateDeckContentsRequest request = new UpdateDeckContentsRequest(
                "Renamed", List.of(),
                List.of(new UpdateDeckContentsRequest.NoteEntry(
                        null, null, Map.of("Front", "q", "Back", "a"), List.of(), null, null, null, null)));

        mockMvc.perform(put("/api/v1/decks/{deckId}/contents", deckId)
                        .with(jwt().jwt(j -> j.subject("user-123")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Renamed"));
    }

    @Test
    void replaceContents_returns400_whenNameBlank() throws Exception {
        UpdateDeckContentsRequest request = new UpdateDeckContentsRequest("  ", List.of(), List.of());

        mockMvc.perform(put("/api/v1/decks/{deckId}/contents", UUID.randomUUID())
                        .with(jwt().jwt(j -> j.subject("user-123")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.details.name").exists());
    }

    @Test
    void replaceContents_returns404_whenDeckMissing() throws Exception {
        UUID deckId = UUID.randomUUID();
        when(deckService.replaceDeckContents(eq(CALLER), eq(deckId), any()))
                .thenThrow(new NotFoundException("Deck not found: " + deckId));

        UpdateDeckContentsRequest request = new UpdateDeckContentsRequest("Deck", List.of(), List.of());

        mockMvc.perform(put("/api/v1/decks/{deckId}/contents", deckId)
                        .with(jwt().jwt(j -> j.subject("user-123")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isNotFound());
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
    void setDeckLanguages_returns200_withUpdatedContents() throws Exception {
        UUID deckId = UUID.randomUUID();
        DeckContentsResponse response = new DeckContentsResponse(
                deckId, "JLPT N4", null, null, 1, OffsetDateTime.now(), 0.0, "ja", "en",
                false, "user-123", "Alice", null, null, true, false, List.of());
        when(deckService.setDeckLanguages(eq("user-123"), eq(deckId), eq("ja"), eq("en")))
                .thenReturn(response);

        mockMvc.perform(put("/api/v1/decks/{deckId}/languages", deckId)
                        .with(jwt().jwt(j -> j.subject("user-123")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new SetDeckLanguagesRequest("ja", "en"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.frontLang").value("ja"))
                .andExpect(jsonPath("$.backLang").value("en"));
    }

    @Test
    void setDeckSharing_returns200_withIsPublicTrue() throws Exception {
        UUID deckId = UUID.randomUUID();
        DeckResponse response = new DeckResponse(
                deckId, "JLPT N4", null, null, 1, OffsetDateTime.now(), 0.0, null, null,
                true, "user-123", "Alice", null, null
        );
        when(deckService.setDeckSharing(eq("user-123"), eq(deckId), eq(true))).thenReturn(response);

        mockMvc.perform(patch("/api/v1/decks/{deckId}/share", deckId)
                        .with(jwt().jwt(j -> j.subject("user-123")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ShareDeckRequest(true))))
                .andExpect(status().isOk())
                // The FE reads this exact key to drive the share toggle.
                .andExpect(jsonPath("$.isPublic").value(true));
    }

    @Test
    void setDeckSharing_returns400_whenIsPublicMissing() throws Exception {
        mockMvc.perform(patch("/api/v1/decks/{deckId}/share", UUID.randomUUID())
                        .with(jwt().jwt(j -> j.subject("user-123")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.details.isPublic").exists());
    }

    @Test
    void setDeckSharing_returns404_whenDeckNotOwned() throws Exception {
        UUID deckId = UUID.randomUUID();
        when(deckService.setDeckSharing(eq("user-123"), eq(deckId), eq(true)))
                .thenThrow(new NotFoundException("Deck not found: " + deckId));

        mockMvc.perform(patch("/api/v1/decks/{deckId}/share", deckId)
                        .with(jwt().jwt(j -> j.subject("user-123")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ShareDeckRequest(true))))
                .andExpect(status().isNotFound());
    }

    @Test
    void setDeckSharing_returns409_whenPublishingAnUntouchedCopy() throws Exception {
        UUID deckId = UUID.randomUUID();
        when(deckService.setDeckSharing(eq("user-123"), eq(deckId), eq(true)))
                .thenThrow(new ConflictException("Edit it to make it your own before sharing it."));

        mockMvc.perform(patch("/api/v1/decks/{deckId}/share", deckId)
                        .with(jwt().jwt(j -> j.subject("user-123")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ShareDeckRequest(true))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.message").value("Edit it to make it your own before sharing it."));
    }

    @Test
    void countCopies_returns200_withTheCount() throws Exception {
        UUID deckId = UUID.randomUUID();
        when(deckService.countCopies(eq("user-123"), eq(deckId))).thenReturn(7L);

        mockMvc.perform(get("/api/v1/decks/{deckId}/copies", deckId)
                        .with(jwt().jwt(j -> j.subject("user-123"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.copies").value(7));
    }

    @Test
    void openDeck_returns204() throws Exception {
        UUID deckId = UUID.randomUUID();

        mockMvc.perform(post("/api/v1/decks/{deckId}/open", deckId)
                        .with(jwt().jwt(j -> j.subject("user-123"))))
                .andExpect(status().isNoContent());

        verify(deckService).openDeck("user-123", deckId);
    }

    @Test
    void setSaved_returns204() throws Exception {
        UUID deckId = UUID.randomUUID();

        mockMvc.perform(put("/api/v1/decks/{deckId}/save", deckId)
                        .with(jwt().jwt(j -> j.subject("user-123")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new SaveDeckRequest(true))))
                .andExpect(status().isNoContent());

        verify(deckService).setSaved("user-123", deckId, true);
    }

    @Test
    void setSaved_returns400_whenSavedMissing() throws Exception {
        mockMvc.perform(put("/api/v1/decks/{deckId}/save", UUID.randomUUID())
                        .with(jwt().jwt(j -> j.subject("user-123")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.details.saved").exists());
    }

    @Test
    void getSaved_returns200_withTheSavedDecks() throws Exception {
        UUID deckId = UUID.randomUUID();
        when(deckService.getSavedDecks("user-123")).thenReturn(List.of(new DeckResponse(
                deckId, "JLPT N4", null, null, 12, OffsetDateTime.now(), 30.0, "ja", "en",
                true, "user-999", "Alice", null, null)));

        mockMvc.perform(get("/api/v1/decks/saved").with(jwt().jwt(j -> j.subject("user-123"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(deckId.toString()))
                .andExpect(jsonPath("$[0].completion").value(30.0));
    }

    @Test
    void getRecent_returns200_withTheRecentDecks() throws Exception {
        when(deckService.getRecentDecks("user-123")).thenReturn(List.of());

        mockMvc.perform(get("/api/v1/decks/recent").with(jwt().jwt(j -> j.subject("user-123"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    @Test
    void cloneDeck_returns201_withTheNewDeck() throws Exception {
        UUID sourceId = UUID.randomUUID();
        UUID cloneId = UUID.randomUUID();
        DeckResponse response = new DeckResponse(
                cloneId, "JLPT N4", null, null, 12, OffsetDateTime.now(), 0.0, "ja", "en",
                false, "user-123", "Alice", null, "Alice"
        );
        when(deckService.cloneDeck(eq(OTHER_CALLER), eq(sourceId))).thenReturn(response);

        mockMvc.perform(post("/api/v1/decks/{deckId}/clone", sourceId)
                        .with(jwt().jwt(j -> j.subject("user-456"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(cloneId.toString()))
                .andExpect(jsonPath("$.completion").value(0.0))
                // A clone is private even when the source was shared.
                .andExpect(jsonPath("$.isPublic").value(false));
    }

    @Test
    void cloneDeck_returns404_whenSourceNotShared() throws Exception {
        UUID sourceId = UUID.randomUUID();
        when(deckService.cloneDeck(eq(OTHER_CALLER), eq(sourceId)))
                .thenThrow(new NotFoundException("Shared deck not found: " + sourceId));

        mockMvc.perform(post("/api/v1/decks/{deckId}/clone", sourceId)
                        .with(jwt().jwt(j -> j.subject("user-456"))))
                .andExpect(status().isNotFound());
    }

    @Test
    void importDeck_returns400_whenNoteTypesEmpty() throws Exception {
        ImportDeckRequest request = new ImportDeckRequest(
                "deck", null, "n4.apkg", null, null, true, List.of()
        );

        mockMvc.perform(post("/api/v1/decks")
                        .with(jwt().jwt(j -> j.subject("user-123")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.details.noteTypes").exists());
    }
}
