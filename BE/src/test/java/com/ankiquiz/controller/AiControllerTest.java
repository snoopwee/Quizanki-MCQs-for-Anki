package com.ankiquiz.controller;

import com.ankiquiz.dto.request.AiDraftRequest;
import com.ankiquiz.dto.response.AiDeckDraftResponse;
import com.ankiquiz.dto.response.ApkgNotesResponse;
import com.ankiquiz.exception.AiUnavailableException;
import com.ankiquiz.exception.GlobalExceptionHandler;
import com.ankiquiz.exception.RateLimitExceededException;
import com.ankiquiz.service.ai.AiDeckDraftService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AiController.class)
@Import(GlobalExceptionHandler.class)
// A tiny PDF cap so the oversized-upload case doesn't have to allocate 20 MB.
@TestPropertySource(properties = "ai.request.max-pdf-bytes=64")
class AiControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private AiDeckDraftService draftService;

    @MockBean
    private JwtDecoder jwtDecoder;

    private AiDeckDraftResponse draft() {
        ApkgNotesResponse.ParsedNote note = new ApkgNotesResponse.ParsedNote(
                null, Map.of("Front", "犬", "Back", "dog"), List.of(), null, null, null, null);
        ApkgNotesResponse.NoteTypeNotes type = new ApkgNotesResponse.NoteTypeNotes(
                1L, "Basic", false, List.of("Front", "Back"), List.of("Front"), List.of("Back"),
                List.of("Front", "Back"), 1, List.of(note));
        return new AiDeckDraftResponse(
                new ApkgNotesResponse("Animals", "ai", "ai", 1, 0, 0, 0, List.of(type)),
                new AiDeckDraftResponse.Meta("gemini", "test-model", "shared", 4, 1, 1, false, false));
    }

    private String body(String text) throws Exception {
        return objectMapper.writeValueAsString(new AiDraftRequest(text, "Animals", null, "Asia/Ho_Chi_Minh"));
    }

    @Test
    void returnsTheDraftAndWhatItCost() throws Exception {
        when(draftService.fromText(eq("user-1"), any(), any())).thenReturn(draft());

        mockMvc.perform(post("/api/v1/ai/decks/draft")
                        .with(jwt().jwt(j -> j.subject("user-1")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("Kanji for animals, with enough text to be worth generating from.")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.draft.filename").value("Animals"))
                .andExpect(jsonPath("$.draft.noteTypes[0].fieldNames[0]").value("Front"))
                .andExpect(jsonPath("$.meta.keyOwner").value("shared"))
                .andExpect(jsonPath("$.meta.remainingToday").value(4));
    }

    @Test
    void emptyMaterialIsRejectedBeforeTheService() throws Exception {
        mockMvc.perform(post("/api/v1/ai/decks/draft")
                        .with(jwt().jwt(j -> j.subject("user-1")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("   ")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.details.text").exists());

        verify(draftService, never()).fromText(any(), any(), any());
    }

    @Test
    void aSpentQuotaIs429_soTheUiCanOfferTheirOwnKey() throws Exception {
        when(draftService.fromText(any(), any(), any()))
                .thenThrow(new RateLimitExceededException("You've used today's 5 free generations."));

        mockMvc.perform(post("/api/v1/ai/decks/draft")
                        .with(jwt().jwt(j -> j.subject("user-1")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("Material that is long enough to be generated from.")))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.message").value("You've used today's 5 free generations."));
    }

    @Test
    void aDormantOrBrokenProviderIs503() throws Exception {
        when(draftService.fromText(any(), any(), any()))
                .thenThrow(new AiUnavailableException("AI generation is switched off on this server."));

        mockMvc.perform(post("/api/v1/ai/decks/draft")
                        .with(jwt().jwt(j -> j.subject("user-1")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("Material that is long enough to be generated from.")))
                .andExpect(status().isServiceUnavailable());
    }

    // ── PDF upload (S3) ─────────────────────────────────────────────────────

    private static MockMultipartFile pdfUpload(String filename, String contentType, int bytes) {
        return new MockMultipartFile("file", filename, contentType, new byte[bytes]);
    }

    @Test
    void acceptsAPdfUploadAndReturnsTheSameDraftShape() throws Exception {
        when(draftService.fromPdf(eq("user-1"), any(), any(), eq("kanji.pdf"), eq("Kanji"), eq(30)))
                .thenReturn(draft());

        mockMvc.perform(multipart("/api/v1/ai/decks/draft/pdf")
                        .file(pdfUpload("kanji.pdf", "application/pdf", 16))
                        .param("deckName", "Kanji")
                        .param("maxCards", "30")
                        .param("tz", "Asia/Ho_Chi_Minh")
                        .with(jwt().jwt(j -> j.subject("user-1"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.draft.noteTypes[0].fieldNames[0]").value("Front"))
                .andExpect(jsonPath("$.meta.cards").value(1));
    }

    @Test
    void acceptsAPdfTheBrowserLabelledVaguely_ifTheNameSaysPdf() throws Exception {
        when(draftService.fromPdf(any(), any(), any(), any(), any(), any())).thenReturn(draft());

        mockMvc.perform(multipart("/api/v1/ai/decks/draft/pdf")
                        .file(pdfUpload("chapter.PDF", "application/octet-stream", 16))
                        .with(jwt().jwt(j -> j.subject("user-1"))))
                .andExpect(status().isOk());
    }

    @Test
    void rejectsSomethingThatIsNotAPdf() throws Exception {
        mockMvc.perform(multipart("/api/v1/ai/decks/draft/pdf")
                        .file(pdfUpload("notes.txt", "text/plain", 16))
                        .with(jwt().jwt(j -> j.subject("user-1"))))
                .andExpect(status().isBadRequest());

        verify(draftService, never()).fromPdf(any(), any(), any(), any(), any(), any());
    }

    @Test
    void rejectsAnEmptyUpload() throws Exception {
        mockMvc.perform(multipart("/api/v1/ai/decks/draft/pdf")
                        .file(pdfUpload("empty.pdf", "application/pdf", 0))
                        .with(jwt().jwt(j -> j.subject("user-1"))))
                .andExpect(status().isBadRequest());

        verify(draftService, never()).fromPdf(any(), any(), any(), any(), any(), any());
    }

    @Test
    void rejectsAnOversizedPdfBeforeReadingIt() throws Exception {
        // The cap is 64 bytes in this slice (see @TestPropertySource), so this stands in for a
        // textbook-sized upload without allocating one.
        mockMvc.perform(multipart("/api/v1/ai/decks/draft/pdf")
                        .file(pdfUpload("textbook.pdf", "application/pdf", 65))
                        .with(jwt().jwt(j -> j.subject("user-1"))))
                .andExpect(status().isBadRequest());

        verify(draftService, never()).fromPdf(any(), any(), any(), any(), any(), any());
    }

    @Test
    void pdfGenerationIsForSignedInUsersOnly() throws Exception {
        mockMvc.perform(multipart("/api/v1/ai/decks/draft/pdf")
                        .file(pdfUpload("kanji.pdf", "application/pdf", 16))
                        .with(csrf()))
                .andExpect(status().isUnauthorized());

        verify(draftService, never()).fromPdf(any(), any(), any(), any(), any(), any());
    }

    @Test
    void generationIsForSignedInUsersOnly() throws Exception {
        // csrf() only so CSRF doesn't answer first: this slice doesn't load SecurityConfig, which
        // disables it in production. What is asserted is the 401.
        mockMvc.perform(post("/api/v1/ai/decks/draft")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("Material that is long enough to be generated from.")))
                .andExpect(status().isUnauthorized());

        verify(draftService, never()).fromText(any(), any(), any());
    }
}
