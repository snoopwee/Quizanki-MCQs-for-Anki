package com.ankiquiz.controller;

import com.ankiquiz.dto.response.ApkgNotesResponse;
import com.ankiquiz.exception.RateLimitExceededException;
import com.ankiquiz.service.ApkgParseRateLimiter;
import com.ankiquiz.service.ApkgParserService;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * Public, unauthenticated .apkg parsing for guest "try-before-signup" and for
 * logged-in import alike. Stateless — persists nothing. Whitelisted in
 * {@code SecurityConfig} under {@code /api/v1/public/**}; per-IP rate limited so
 * an anonymous flood can't exhaust a free-tier host's compute budget.
 */
@RestController
@RequestMapping("/api/v1/public")
public class ApkgParseController {

    private final ApkgParserService parserService;
    private final ApkgParseRateLimiter rateLimiter;

    public ApkgParseController(ApkgParserService parserService, ApkgParseRateLimiter rateLimiter) {
        this.parserService = parserService;
        this.rateLimiter = rateLimiter;
    }

    @PostMapping(value = "/parse-apkg", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Parse an uploaded .apkg file (public, no auth, persists nothing)",
            description = "Chunk 4: reads the notes, maps each to its note type's field names, "
                    + "cleans the values, and returns them grouped by note type (sampled). "
                    + "Per-IP rate limited.")
    public ApkgNotesResponse parseApkg(@RequestParam("file") MultipartFile file, HttpServletRequest http) {
        if (!rateLimiter.tryAcquire(clientIp(http))) {
            throw new RateLimitExceededException(
                    "Too many uploads from your network. Please wait a few minutes and try again.");
        }
        return parserService.parseNotes(file);
    }

    // Behind Render / Cloudflare the socket address is the proxy; the real
    // client IP is the first hop in X-Forwarded-For.
    private static String clientIp(HttpServletRequest http) {
        String forwarded = http.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return http.getRemoteAddr();
    }
}
