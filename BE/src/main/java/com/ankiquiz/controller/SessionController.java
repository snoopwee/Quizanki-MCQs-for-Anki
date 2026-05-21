package com.ankiquiz.controller;

import com.ankiquiz.dto.request.RecordAnswerRequest;
import com.ankiquiz.dto.request.StartSessionRequest;
import com.ankiquiz.dto.response.RecordAnswerResponse;
import com.ankiquiz.dto.response.StartSessionResponse;
import com.ankiquiz.service.SessionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/sessions")
@SecurityRequirement(name = "bearerAuth")
public class SessionController {

    private final SessionService sessionService;

    public SessionController(SessionService sessionService) {
        this.sessionService = sessionService;
    }

    @PostMapping
    @Operation(summary = "Start a quiz session", description = "Validates deck ownership and returns a session id.")
    public ResponseEntity<StartSessionResponse> startSession(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody StartSessionRequest request
    ) {
        StartSessionResponse body = sessionService.startSession(jwt.getSubject(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(body);
    }

    @PostMapping("/{sessionId}/answers")
    @Operation(summary = "Record an answer",
            description = "Calls record_answer() and returns the note's updated accuracy and streak.")
    public RecordAnswerResponse recordAnswer(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID sessionId,
            @Valid @RequestBody RecordAnswerRequest request
    ) {
        return sessionService.recordAnswer(jwt.getSubject(), request);
    }
}
