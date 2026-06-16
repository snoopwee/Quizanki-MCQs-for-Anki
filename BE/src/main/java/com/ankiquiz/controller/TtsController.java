package com.ankiquiz.controller;

import com.ankiquiz.dto.request.TtsRequest;
import com.ankiquiz.dto.response.TtsResponse;
import com.ankiquiz.exception.RateLimitExceededException;
import com.ankiquiz.service.TtsRateLimiter;
import com.ankiquiz.service.TtsService;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Public, unauthenticated cloud text-to-speech for the flashcard speaker. The FE
 * only calls this for a language segment the visitor's device has no voice for, so
 * synthesis stays the exception, not the rule. Whitelisted in {@code SecurityConfig}
 * under {@code /api/v1/public/**}; per-IP rate limited.
 */
@RestController
@RequestMapping("/api/v1/public")
public class TtsController {

    private final TtsService ttsService;
    private final TtsRateLimiter rateLimiter;

    public TtsController(TtsService ttsService, TtsRateLimiter rateLimiter) {
        this.ttsService = ttsService;
        this.rateLimiter = rateLimiter;
    }

    @PostMapping("/tts")
    @Operation(summary = "Synthesize speech for a text segment (public; cloud fallback for "
            + "languages the visitor's device can't speak)",
            description = "Returns a playable audio URL — a cached public Supabase Storage URL, "
                    + "or an inline data URL when caching isn't configured. 503 when cloud TTS "
                    + "is not configured (the FE then stays on device voices).")
    public TtsResponse synthesize(@Valid @RequestBody TtsRequest request, HttpServletRequest http) {
        if (!rateLimiter.tryAcquire(clientIp(http))) {
            throw new RateLimitExceededException("Too many text-to-speech requests. Please slow down.");
        }
        return ttsService.synthesizeToUrl(request.text(), request.lang());
    }

    // Behind Render / Cloudflare the socket address is the proxy; the real client
    // IP is the first hop in X-Forwarded-For.
    private static String clientIp(HttpServletRequest http) {
        String forwarded = http.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return http.getRemoteAddr();
    }
}
