package com.ankiquiz.controller;

import com.ankiquiz.dto.request.AnnouncementRequest;
import com.ankiquiz.exception.GlobalExceptionHandler;
import com.ankiquiz.service.AdminUserService;
import com.ankiquiz.service.NotificationService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The admin broadcast. ROLE_ADMIN gating itself lives in SecurityConfig (see
 * AdminControllerSecurityTest); what matters here is that the audience can only widen when the
 * request literally says so, and that an admin's typo comes back as a 400 rather than a clipped row.
 */
@WebMvcTest(AdminAnnouncementController.class)
@Import(GlobalExceptionHandler.class)
class AdminAnnouncementControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private NotificationService notificationService;

    @MockBean
    private AdminUserService adminUserService;

    @MockBean
    private JwtDecoder jwtDecoder;

    private String body(String title, String text, String link, String audience) throws Exception {
        return objectMapper.writeValueAsString(new AnnouncementRequest(title, text, link, audience));
    }

    @Test
    void audienceAllFansOutOverEveryUser() throws Exception {
        when(adminUserService.allUserIds(anyInt())).thenReturn(List.of("user-1", "user-2", "user-3"));
        when(notificationService.announce(any(), any(), any(), any())).thenReturn(3);

        mockMvc.perform(post("/api/v1/admin/announcements")
                        .with(jwt().jwt(j -> j.subject("admin-1")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("Maintenance tonight", "Ten minutes from 22:00.", "/help", "all")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.audience").value("all"))
                .andExpect(jsonPath("$.recipients").value(3))
                .andExpect(jsonPath("$.sent").value(3));

        verify(notificationService).announce(List.of("user-1", "user-2", "user-3"),
                "Maintenance tonight", "Ten minutes from 22:00.", "/help");
    }

    @Test
    void audienceMeNotifiesOnlyTheSendingAdmin() throws Exception {
        when(notificationService.announce(any(), any(), any(), any())).thenReturn(1);

        mockMvc.perform(post("/api/v1/admin/announcements")
                        .with(jwt().jwt(j -> j.subject("admin-1")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("Test", null, null, "me")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.audience").value("me"))
                .andExpect(jsonPath("$.recipients").value(1));

        verify(notificationService).announce(List.of("admin-1"), "Test", null, null);
        // A test send must not go anywhere near the user list.
        verify(adminUserService, never()).allUserIds(anyInt());
    }

    @Test
    void anAbsentAudienceFailsTowardsTheSmallerOne() throws Exception {
        when(notificationService.announce(any(), any(), any(), any())).thenReturn(1);

        mockMvc.perform(post("/api/v1/admin/announcements")
                        .with(jwt().jwt(j -> j.subject("admin-1")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("Test", null, null, null)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.audience").value("me"));

        verify(adminUserService, never()).allUserIds(anyInt());
    }

    @Test
    void anUnrecognisedAudienceIsRejectedRatherThanGuessed() throws Exception {
        mockMvc.perform(post("/api/v1/admin/announcements")
                        .with(jwt().jwt(j -> j.subject("admin-1")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("Test", null, null, "everyone")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.details.audience").exists());

        verify(notificationService, never()).announce(any(), any(), any(), any());
    }

    @Test
    void reportsHowManyRowsWereActuallyWritten() throws Exception {
        when(adminUserService.allUserIds(anyInt())).thenReturn(List.of("user-1", "user-2"));
        // One recipient was dropped (a blank or duplicate id), so the numbers differ on purpose.
        when(notificationService.announce(any(), any(), any(), any())).thenReturn(1);

        mockMvc.perform(post("/api/v1/admin/announcements")
                        .with(jwt().jwt(j -> j.subject("admin-1")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("Hello", null, null, "all")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.recipients").value(2))
                .andExpect(jsonPath("$.sent").value(1));
    }

    @Test
    void aBlankOrOversizedTitleIsRejected() throws Exception {
        mockMvc.perform(post("/api/v1/admin/announcements")
                        .with(jwt().jwt(j -> j.subject("admin-1")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("   ", null, null, "me")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.details.title").exists());

        mockMvc.perform(post("/api/v1/admin/announcements")
                        .with(jwt().jwt(j -> j.subject("admin-1")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("t".repeat(121), null, null, "me")))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/v1/admin/announcements")
                        .with(jwt().jwt(j -> j.subject("admin-1")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("Fine", "b".repeat(501), null, "me")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.details.body").exists());

        verify(notificationService, never()).announce(any(), any(), any(), any());
    }

    @Test
    void aBroadcastCannotSendEveryUserOffSite() throws Exception {
        for (String link : List.of("https://evil.example", "//evil.example", "javascript:alert(1)",
                "/\\evil.example", "help")) {
            mockMvc.perform(post("/api/v1/admin/announcements")
                            .with(jwt().jwt(j -> j.subject("admin-1")))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(body("Heads up", null, link, "all")))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.details.link").exists());
        }

        verify(notificationService, never()).announce(any(), any(), any(), any());
    }

    @Test
    void anEmptyLinkJustMeansNoLink() throws Exception {
        when(notificationService.announce(any(), any(), any(), any())).thenReturn(1);

        mockMvc.perform(post("/api/v1/admin/announcements")
                        .with(jwt().jwt(j -> j.subject("admin-1")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("Heads up", null, "", "me")))
                .andExpect(status().isCreated());

        verify(notificationService).announce(List.of("admin-1"), "Heads up", null, "");
    }

    @Test
    void theAudiencePreviewCountsWithoutWritingAnything() throws Exception {
        when(adminUserService.allUserIds(eq(AdminAnnouncementController.MAX_RECIPIENTS)))
                .thenReturn(List.of("user-1", "user-2", "user-3", "user-4"));

        mockMvc.perform(get("/api/v1/admin/announcements/audience")
                        .with(jwt().jwt(j -> j.subject("admin-1"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.recipients").value(4));

        verify(notificationService, never()).announce(any(), any(), any(), any());
    }

    @Test
    void bothRoutesNeedAuthentication() throws Exception {
        mockMvc.perform(get("/api/v1/admin/announcements/audience")).andExpect(status().isUnauthorized());
        // csrf() because a @WebMvcTest slice doesn't load SecurityConfig (which disables CSRF), so
        // the POST would otherwise be refused as 403 before authentication is reached.
        mockMvc.perform(post("/api/v1/admin/announcements")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body("Hello", null, null, "all")))
                .andExpect(status().isUnauthorized());

        verify(notificationService, never()).announce(any(), any(), any(), any());
        verify(adminUserService, never()).allUserIds(anyInt());
    }
}
