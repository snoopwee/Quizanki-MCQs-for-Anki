package com.ankiquiz.controller;

import com.ankiquiz.dto.request.FolderRequest;
import com.ankiquiz.dto.response.FolderDetailResponse;
import com.ankiquiz.dto.response.FolderResponse;
import com.ankiquiz.exception.ConflictException;
import com.ankiquiz.exception.GlobalExceptionHandler;
import com.ankiquiz.exception.NotFoundException;
import com.ankiquiz.service.FolderService;
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
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(FolderController.class)
@Import(GlobalExceptionHandler.class)
class FolderControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private FolderService folderService;

    @MockBean
    private JwtDecoder jwtDecoder;

    private final UUID folderId = UUID.randomUUID();
    private final UUID deckId = UUID.randomUUID();

    private String body(String name) throws Exception {
        return objectMapper.writeValueAsString(new FolderRequest(name));
    }

    @Test
    void listsFoldersWithCounts() throws Exception {
        when(folderService.list("user-1", null))
                .thenReturn(List.of(new FolderResponse(folderId, "Japanese", 3, OffsetDateTime.parse("2026-09-21T09:00:00Z"), false)));

        mockMvc.perform(get("/api/v1/me/folders").with(jwt().jwt(j -> j.subject("user-1"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Japanese"))
                .andExpect(jsonPath("$[0].deckCount").value(3));
    }

    @Test
    void theDeckPagePickerAsksWhichFoldersHoldOneDeck() throws Exception {
        when(folderService.list(eq("user-1"), eq(deckId)))
                .thenReturn(List.of(new FolderResponse(folderId, "Japanese", 3,
                        OffsetDateTime.parse("2026-09-21T09:00:00Z"), true)));

        mockMvc.perform(get("/api/v1/me/folders").param("deckId", deckId.toString())
                        .with(jwt().jwt(j -> j.subject("user-1"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].containsDeck").value(true));
    }

    @Test
    void createReturns201() throws Exception {
        when(folderService.create(eq("user-1"), eq("Japanese")))
                .thenReturn(new FolderResponse(folderId, "Japanese", 0, OffsetDateTime.parse("2026-09-21T09:00:00Z"), false));

        mockMvc.perform(post("/api/v1/me/folders")
                        .with(jwt().jwt(j -> j.subject("user-1")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("Japanese")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(folderId.toString()));
    }

    @Test
    void aBlankOrOversizedNameIsRejectedByValidation() throws Exception {
        mockMvc.perform(post("/api/v1/me/folders")
                        .with(jwt().jwt(j -> j.subject("user-1")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("   ")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.details.name").exists());

        mockMvc.perform(post("/api/v1/me/folders")
                        .with(jwt().jwt(j -> j.subject("user-1")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("x".repeat(61))))
                .andExpect(status().isBadRequest());

        verify(folderService, never()).create(any(), any());
    }

    @Test
    void aDuplicateNameIs409() throws Exception {
        when(folderService.create(any(), any()))
                .thenThrow(new ConflictException("You already have a folder called \"Japanese\"."));

        mockMvc.perform(post("/api/v1/me/folders")
                        .with(jwt().jwt(j -> j.subject("user-1")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("Japanese")))
                .andExpect(status().isConflict());
    }

    @Test
    void someoneElsesFolderIs404() throws Exception {
        when(folderService.get(any(), any())).thenThrow(new NotFoundException("Folder not found"));

        mockMvc.perform(get("/api/v1/me/folders/{id}", folderId).with(jwt().jwt(j -> j.subject("user-2"))))
                .andExpect(status().isNotFound());
    }

    @Test
    void returnsAFoldersDecks() throws Exception {
        when(folderService.get(eq("user-1"), eq(folderId)))
                .thenReturn(new FolderDetailResponse(folderId, "Japanese", List.of()));

        mockMvc.perform(get("/api/v1/me/folders/{id}", folderId).with(jwt().jwt(j -> j.subject("user-1"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Japanese"))
                .andExpect(jsonPath("$.decks").isArray());
    }

    @Test
    void renameFileAndUnfileGoThrough() throws Exception {
        when(folderService.rename(any(), any(), any()))
                .thenReturn(new FolderResponse(folderId, "Kanji", 1, OffsetDateTime.parse("2026-09-21T09:00:00Z"), false));

        mockMvc.perform(patch("/api/v1/me/folders/{id}", folderId)
                        .with(jwt().jwt(j -> j.subject("user-1")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("Kanji")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Kanji"));

        mockMvc.perform(put("/api/v1/me/folders/{id}/decks/{deckId}", folderId, deckId)
                        .with(jwt().jwt(j -> j.subject("user-1"))))
                .andExpect(status().isNoContent());
        verify(folderService).addDeck("user-1", folderId, deckId);

        mockMvc.perform(delete("/api/v1/me/folders/{id}/decks/{deckId}", folderId, deckId)
                        .with(jwt().jwt(j -> j.subject("user-1"))))
                .andExpect(status().isNoContent());
        verify(folderService).removeDeck("user-1", folderId, deckId);
    }

    @Test
    void deleteReturns204() throws Exception {
        mockMvc.perform(delete("/api/v1/me/folders/{id}", folderId).with(jwt().jwt(j -> j.subject("user-1"))))
                .andExpect(status().isNoContent());

        verify(folderService).delete("user-1", folderId);
    }

    @Test
    void everyFolderRouteNeedsAuthentication() throws Exception {
        mockMvc.perform(get("/api/v1/me/folders")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/me/folders/{id}", folderId)).andExpect(status().isUnauthorized());
        mockMvc.perform(delete("/api/v1/me/folders/{id}", folderId).with(csrf()))
                .andExpect(status().isUnauthorized());

        verify(folderService, never()).list(any());
        verify(folderService, never()).delete(any(), any());
    }
}
