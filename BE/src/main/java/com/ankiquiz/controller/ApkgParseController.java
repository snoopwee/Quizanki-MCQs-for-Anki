package com.ankiquiz.controller;

import com.ankiquiz.dto.response.ApkgNotesResponse;
import com.ankiquiz.service.ApkgParserService;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * Public, unauthenticated .apkg parsing for guest "try-before-signup" and for
 * logged-in import alike. Stateless — persists nothing. Whitelisted in
 * {@code SecurityConfig} under {@code /api/v1/public/**}.
 */
@RestController
@RequestMapping("/api/v1/public")
public class ApkgParseController {

    private final ApkgParserService parserService;

    public ApkgParseController(ApkgParserService parserService) {
        this.parserService = parserService;
    }

    @PostMapping(value = "/parse-apkg", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Parse an uploaded .apkg file (public, no auth, persists nothing)",
            description = "Chunk 4: reads the notes, maps each to its note type's field names, "
                    + "cleans the values, and returns them grouped by note type (sampled).")
    public ApkgNotesResponse parseApkg(@RequestParam("file") MultipartFile file) {
        return parserService.parseNotes(file);
    }
}
