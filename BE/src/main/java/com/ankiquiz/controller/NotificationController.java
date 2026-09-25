package com.ankiquiz.controller;

import com.ankiquiz.dto.response.NotificationPage;
import com.ankiquiz.dto.response.UnreadCountResponse;
import com.ankiquiz.service.NotificationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Your own notifications, so they live under {@code /me}. There is no way to read anyone else's
 * and no way to create one from the outside — notifications are written by the features that cause
 * them (an admin broadcast, a deck shared with you), never posted by a client.
 */
@RestController
@RequestMapping("/api/v1/me/notifications")
@SecurityRequirement(name = "bearerAuth")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping
    @Operation(summary = "Your notifications, newest first",
            description = "Includes the total unread count, so opening the bell is one request. "
                    + "`offset` is a row offset and is snapped to a page boundary; page size is capped at 50.")
    public NotificationPage list(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(value = "limit", defaultValue = "20") int limit,
            @RequestParam(value = "offset", defaultValue = "0") int offset
    ) {
        return notificationService.page(jwt.getSubject(), limit, offset);
    }

    @GetMapping("/unread-count")
    @Operation(summary = "How many are unread",
            description = "The cheapest call for the bell's badge — a count, no rows.")
    public UnreadCountResponse unreadCount(@AuthenticationPrincipal Jwt jwt) {
        return new UnreadCountResponse(notificationService.unreadCount(jwt.getSubject()));
    }

    @PostMapping("/{notificationId}/read")
    @Operation(summary = "Mark one as read",
            description = "Idempotent. Someone else's notification is 404, not 403.")
    public ResponseEntity<Void> markRead(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID notificationId
    ) {
        notificationService.markRead(jwt.getSubject(), notificationId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/read-all")
    @Operation(summary = "Mark everything as read", description = "Clears the badge in one call.")
    public ResponseEntity<Void> markAllRead(@AuthenticationPrincipal Jwt jwt) {
        notificationService.markAllRead(jwt.getSubject());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{notificationId}")
    @Operation(summary = "Delete one",
            description = "204 whether or not it was there: a delete that finds nothing has already "
                    + "done what was asked, and the same answer for \"already gone\" and \"not "
                    + "yours\" keeps another user's id unconfirmable.")
    public ResponseEntity<Void> delete(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID notificationId
    ) {
        notificationService.delete(jwt.getSubject(), notificationId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping
    @Operation(summary = "Clear all of yours",
            description = "Removes every notification for the caller — read or not. Nobody else's "
                    + "bell is touched, and there is no undo, so the client confirms first.")
    public ResponseEntity<Void> clear(@AuthenticationPrincipal Jwt jwt) {
        notificationService.clear(jwt.getSubject());
        return ResponseEntity.noContent().build();
    }
}
