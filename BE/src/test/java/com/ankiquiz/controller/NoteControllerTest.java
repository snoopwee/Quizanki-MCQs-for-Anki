package com.ankiquiz.controller;

import com.ankiquiz.dto.request.SetStarRequest;
import com.ankiquiz.dto.request.UpdateNoteRequest;
import com.ankiquiz.dto.response.CardStatsResponse;
import com.ankiquiz.dto.response.NoteResponse;
import com.ankiquiz.exception.GlobalExceptionHandler;
import com.ankiquiz.exception.NotFoundException;
import com.ankiquiz.service.Caller;
import com.ankiquiz.service.NoteService;
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
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(NoteController.class)
@Import(GlobalExceptionHandler.class)
class NoteControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private NoteService noteService;

    // What Caller.from() resolves the bare test JWT to (no email / user_metadata
    // claim on it, so the display name falls all the way through to anonymous).
    private static final Caller CALLER = new Caller("user-1", Caller.ANONYMOUS, null);

    @MockBean
    private JwtDecoder jwtDecoder;

    @Test
    void getNotes_returns200_withNotes() throws Exception {
        UUID deckId = UUID.randomUUID();
        UUID noteId = UUID.randomUUID();
        NoteResponse note = new NoteResponse(
                noteId, deckId,
                Map.of("Front", "食べる", "Back", "to eat"),
                List.of("N4", "verb"),
                null, null,
                new CardStatsResponse(3, 2, 0.66, 0, 40.0, true, OffsetDateTime.now())
        );
        when(noteService.getNotes(eq("user-1"), eq(deckId), any(), anyBoolean(), anyBoolean(), any()))
                .thenReturn(List.of(note));

        mockMvc.perform(get("/api/v1/decks/{deckId}/notes", deckId)
                        .with(jwt().jwt(j -> j.subject("user-1"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(noteId.toString()))
                .andExpect(jsonPath("$[0].cardStats.accuracy").value(0.66))
                .andExpect(jsonPath("$[0].cardStats.mastery").value(40.0))
                .andExpect(jsonPath("$[0].cardStats.starred").value(true));
    }

    @Test
    void getNotes_returns404_whenDeckMissing() throws Exception {
        UUID deckId = UUID.randomUUID();
        when(noteService.getNotes(eq("user-1"), eq(deckId), any(), anyBoolean(), anyBoolean(), any()))
                .thenThrow(new NotFoundException("Deck not found: " + deckId));

        mockMvc.perform(get("/api/v1/decks/{deckId}/notes", deckId)
                        .with(jwt().jwt(j -> j.subject("user-1"))))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404));
    }

    @Test
    void updateNote_returns200_withUpdatedFields() throws Exception {
        UUID deckId = UUID.randomUUID();
        UUID noteId = UUID.randomUUID();
        NoteResponse updated = new NoteResponse(
                noteId, deckId,
                Map.of("Front", "食べる", "Back", "to eat (edited)"),
                List.of("N4", "verb"),
                null, null, null
        );
        when(noteService.updateNote(eq(CALLER), eq(deckId), eq(noteId), any(), any(), any(), any(), any()))
                .thenReturn(updated);

        mockMvc.perform(patch("/api/v1/decks/{deckId}/notes/{noteId}", deckId, noteId)
                        .with(jwt().jwt(j -> j.subject("user-1")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new UpdateNoteRequest(
                                Map.of("Front", "食べる", "Back", "to eat (edited)"), null, null, null, null))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(noteId.toString()))
                .andExpect(jsonPath("$.fields.Back").value("to eat (edited)"));
    }

    @Test
    void updateNote_passesFaceLanguageOverrideThrough() throws Exception {
        UUID deckId = UUID.randomUUID();
        UUID noteId = UUID.randomUUID();
        NoteResponse updated = new NoteResponse(
                noteId, deckId, Map.of("Front", "水", "Back", "water"), List.of(), null, null, null);
        when(noteService.updateNote(eq(CALLER), eq(deckId), eq(noteId), any(), eq("ja"), eq("en"), any(), any()))
                .thenReturn(updated);

        mockMvc.perform(patch("/api/v1/decks/{deckId}/notes/{noteId}", deckId, noteId)
                        .with(jwt().jwt(j -> j.subject("user-1")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new UpdateNoteRequest(
                                Map.of("Front", "水", "Back", "water"), "ja", "en", null, null))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(noteId.toString()));
    }

    @Test
    void updateNote_returns400_whenFieldsEmpty() throws Exception {
        mockMvc.perform(patch("/api/v1/decks/{deckId}/notes/{noteId}", UUID.randomUUID(), UUID.randomUUID())
                        .with(jwt().jwt(j -> j.subject("user-1")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new UpdateNoteRequest(Map.of(), null, null, null, null))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.details.fields").exists());
    }

    @Test
    void updateNote_returns404_whenNoteMissing() throws Exception {
        UUID deckId = UUID.randomUUID();
        UUID noteId = UUID.randomUUID();
        when(noteService.updateNote(eq(CALLER), eq(deckId), eq(noteId), any(), any(), any(), any(), any()))
                .thenThrow(new NotFoundException("Note not found: " + noteId));

        mockMvc.perform(patch("/api/v1/decks/{deckId}/notes/{noteId}", deckId, noteId)
                        .with(jwt().jwt(j -> j.subject("user-1")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new UpdateNoteRequest(Map.of("Front", "x"), null, null, null, null))))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404));
    }

    @Test
    void setStarred_returns200_withStarredStats() throws Exception {
        UUID deckId = UUID.randomUUID();
        UUID noteId = UUID.randomUUID();
        NoteResponse starred = new NoteResponse(
                noteId, deckId,
                Map.of("Front", "食べる", "Back", "to eat"),
                List.of(),
                null, null,
                new CardStatsResponse(0, 0, 0.0, 0, 0.0, true, null)
        );
        when(noteService.setStarred(eq("user-1"), eq(deckId), eq(noteId), eq(true)))
                .thenReturn(starred);

        mockMvc.perform(put("/api/v1/decks/{deckId}/notes/{noteId}/star", deckId, noteId)
                        .with(jwt().jwt(j -> j.subject("user-1")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new SetStarRequest(true))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(noteId.toString()))
                .andExpect(jsonPath("$.cardStats.starred").value(true));
    }

    @Test
    void setStarred_returns400_whenStarredMissing() throws Exception {
        mockMvc.perform(put("/api/v1/decks/{deckId}/notes/{noteId}/star", UUID.randomUUID(), UUID.randomUUID())
                        .with(jwt().jwt(j -> j.subject("user-1")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.details.starred").exists());
    }

    @Test
    void setStarred_returns404_whenNoteMissing() throws Exception {
        UUID deckId = UUID.randomUUID();
        UUID noteId = UUID.randomUUID();
        when(noteService.setStarred(eq("user-1"), eq(deckId), eq(noteId), anyBoolean()))
                .thenThrow(new NotFoundException("Note not found: " + noteId));

        mockMvc.perform(put("/api/v1/decks/{deckId}/notes/{noteId}/star", deckId, noteId)
                        .with(jwt().jwt(j -> j.subject("user-1")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new SetStarRequest(false))))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404));
    }
}
