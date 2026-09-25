package com.ankiquiz.controller;

import com.ankiquiz.dto.request.AiKeyRequest;
import com.ankiquiz.dto.response.AiKeyStatusResponse;
import com.ankiquiz.service.ai.AiKeyService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * The caller's own provider API key: store it, see whether one is stored, delete it.
 *
 * There is deliberately no endpoint that returns the key. Once stored it is only ever decrypted
 * server-side for the length of one generation; the UI shows the last four characters.
 */
@RestController
@RequestMapping("/api/v1/me/ai-key")
@SecurityRequirement(name = "bearerAuth")
public class AiKeyController {

    private final AiKeyService keyService;

    public AiKeyController(AiKeyService keyService) {
        this.keyService = keyService;
    }

    @GetMapping
    @Operation(summary = "Whether this account has its own AI key",
            description = "Returns a four-character hint, never the key.")
    public AiKeyStatusResponse get(@AuthenticationPrincipal Jwt jwt) {
        return keyService.status(jwt.getSubject());
    }

    @PutMapping
    @Operation(summary = "Store this account's AI key", description = "Encrypted at rest; replaces any existing key.")
    public AiKeyStatusResponse put(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody AiKeyRequest request
    ) {
        return keyService.save(jwt.getSubject(), request.provider(), request.apiKey());
    }

    @DeleteMapping
    @Operation(summary = "Forget this account's AI key")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal Jwt jwt) {
        keyService.delete(jwt.getSubject());
        return ResponseEntity.noContent().build();
    }
}
