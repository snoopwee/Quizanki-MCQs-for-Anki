package com.ankiquiz.controller;

import com.ankiquiz.dto.response.NotificationPage;
import com.ankiquiz.dto.response.NotificationResponse;
import com.ankiquiz.exception.GlobalExceptionHandler;
import com.ankiquiz.exception.NotFoundException;
import com.ankiquiz.service.NotificationService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.web.servlet.MockMvc;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(NotificationController.class)
@Import(GlobalExceptionHandler.class)
class NotificationControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private NotificationService notificationService;

    @MockBean
    private JwtDecoder jwtDecoder;

    private final UUID notificationId = UUID.randomUUID();
    private final UUID deckId = UUID.randomUUID();

    private NotificationPage onePage() {
        NotificationResponse item = new NotificationResponse(
                notificationId, "deck_shared", "Mai shared a deck with you", "JLPT N3 kanji",
                "/decks/" + deckId, "author-9", "Mai", deckId, false,
                OffsetDateTime.parse("2026-09-22T08:00:00Z"));
        return new NotificationPage(List.of(item), 0, 20, 1, 1, 3);
    }

    @Test
    void listsNotificationsWithTheUnreadCountAlongside() throws Exception {
        when(notificationService.page("user-1", 20, 0)).thenReturn(onePage());

        mockMvc.perform(get("/api/v1/me/notifications").with(jwt().jwt(j -> j.subject("user-1"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].kind").value("deck_shared"))
                .andExpect(jsonPath("$.items[0].title").value("Mai shared a deck with you"))
                .andExpect(jsonPath("$.items[0].link").value("/decks/" + deckId))
                .andExpect(jsonPath("$.items[0].read").value(false))
                // One request is enough to render the panel AND the badge.
                .andExpect(jsonPath("$.unread").value(3));
    }

    @Test
    void theClientsPagingReachesTheService() throws Exception {
        when(notificationService.page(eq("user-1"), eq(50), eq(100))).thenReturn(onePage());

        mockMvc.perform(get("/api/v1/me/notifications")
                        .param("limit", "50")
                        .param("offset", "100")
                        .with(jwt().jwt(j -> j.subject("user-1"))))
                .andExpect(status().isOk());

        verify(notificationService).page("user-1", 50, 100);
    }

    @Test
    void theBadgeHasItsOwnCheapEndpoint() throws Exception {
        when(notificationService.unreadCount("user-1")).thenReturn(7L);

        mockMvc.perform(get("/api/v1/me/notifications/unread-count")
                        .with(jwt().jwt(j -> j.subject("user-1"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unread").value(7));
    }

    @Test
    void markingOneReadReturns204() throws Exception {
        mockMvc.perform(post("/api/v1/me/notifications/{id}/read", notificationId)
                        .with(jwt().jwt(j -> j.subject("user-1"))))
                .andExpect(status().isNoContent());

        verify(notificationService).markRead("user-1", notificationId);
    }

    @Test
    void someoneElsesNotificationIs404() throws Exception {
        doThrow(new NotFoundException("Notification not found"))
                .when(notificationService).markRead(eq("user-2"), any(UUID.class));

        mockMvc.perform(post("/api/v1/me/notifications/{id}/read", notificationId)
                        .with(jwt().jwt(j -> j.subject("user-2"))))
                .andExpect(status().isNotFound());
    }

    @Test
    void markAllReadClearsTheBadgeInOneCall() throws Exception {
        mockMvc.perform(post("/api/v1/me/notifications/read-all")
                        .with(jwt().jwt(j -> j.subject("user-1"))))
                .andExpect(status().isNoContent());

        verify(notificationService).markAllRead("user-1");
    }

    @Test
    void everyNotificationRouteNeedsAuthentication() throws Exception {
        mockMvc.perform(get("/api/v1/me/notifications")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/me/notifications/unread-count")).andExpect(status().isUnauthorized());
        // csrf() because a @WebMvcTest slice doesn't load SecurityConfig (which disables CSRF), so
        // an unauthenticated POST would otherwise be rejected as 403 before auth is even reached.
        mockMvc.perform(post("/api/v1/me/notifications/{id}/read", notificationId).with(csrf()))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/v1/me/notifications/read-all").with(csrf()))
                .andExpect(status().isUnauthorized());

        verify(notificationService, never()).page(any(), org.mockito.ArgumentMatchers.anyInt(),
                org.mockito.ArgumentMatchers.anyInt());
        verify(notificationService, never()).markRead(any(), any());
        verify(notificationService, never()).markAllRead(any());
    }
}
