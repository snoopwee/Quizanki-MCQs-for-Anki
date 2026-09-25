package com.ankiquiz.controller;

import com.ankiquiz.dto.request.AiDraftRequest;
import com.ankiquiz.dto.response.AiDeckDraftResponse;
import com.ankiquiz.exception.AiInputException;
import com.ankiquiz.service.ClientZone;
import com.ankiquiz.service.ai.AiDeckDraftService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Locale;

/**
 * AI deck generation. Signed-in only, like every other write path here — the daily quota is keyed
 * by user id, so there is no anonymous route by construction (user decision, 2026-09-21).
 *
 * Nothing is saved: the response is a draft for the review editor, and the learner decides what
 * becomes a deck.
 */
@RestController
@RequestMapping("/api/v1/ai")
@SecurityRequirement(name = "bearerAuth")
public class AiController {

    private final AiDeckDraftService draftService;
    private final long maxPdfBytes;

    public AiController(
            AiDeckDraftService draftService,
            @Value("${ai.request.max-pdf-bytes:20971520}") long maxPdfBytes
    ) {
        this.draftService = draftService;
        this.maxPdfBytes = maxPdfBytes;
    }

    @PostMapping("/decks/draft")
    @Operation(summary = "Draft a deck from pasted material",
            description = "Returns cards in the .apkg parser's shape for the review editor. Nothing is saved. "
                    + "503 when AI is off or the provider fails, 429 when the daily quota is spent.")
    public AiDeckDraftResponse draft(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody AiDraftRequest request
    ) {
        return draftService.fromText(jwt.getSubject(), ClientZone.parse(request.timezone()), request);
    }

    @PostMapping(value = "/decks/draft/pdf", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Draft a deck from a PDF",
            description = "Reads the PDF's text layer (no OCR — a scanned PDF is rejected with an "
                    + "explanation) and drafts cards from it. Nothing is saved.")
    public AiDeckDraftResponse draftFromPdf(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "deckName", required = false) String deckName,
            @RequestParam(value = "maxCards", required = false) Integer maxCards,
            @RequestParam(value = "tz", required = false) String tz
    ) {
        if (file == null || file.isEmpty()) {
            throw new AiInputException("Choose a PDF to generate from.");
        }
        // Checked before reading the bytes: the global multipart cap is sized for .apkg decks, and
        // a 50 MB PDF has no business being pulled into memory here.
        if (file.getSize() > maxPdfBytes) {
            throw new AiInputException("That PDF is larger than " + (maxPdfBytes / (1024 * 1024))
                    + " MB. Try a single chapter instead.");
        }
        if (!looksLikePdf(file)) {
            throw new AiInputException("That doesn't look like a PDF.");
        }

        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException ex) {
            throw new AiInputException("Couldn't read that upload. Try again.");
        }
        return draftService.fromPdf(jwt.getSubject(), ClientZone.parse(tz), bytes,
                file.getOriginalFilename(), deckName, maxCards);
    }

    // Browsers are inconsistent about the content type on upload, so accept either signal.
    private static boolean looksLikePdf(MultipartFile file) {
        String contentType = file.getContentType();
        if (contentType != null && contentType.toLowerCase(Locale.ROOT).contains("pdf")) {
            return true;
        }
        String name = file.getOriginalFilename();
        return name != null && name.toLowerCase(Locale.ROOT).endsWith(".pdf");
    }
}
