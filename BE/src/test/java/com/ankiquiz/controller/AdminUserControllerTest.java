package com.ankiquiz.controller;

import com.ankiquiz.dto.response.AdminUserResponse;
import com.ankiquiz.dto.response.AdminUsersPage;
import com.ankiquiz.exception.GlobalExceptionHandler;
import com.ankiquiz.service.AdminUserService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AdminUserController.class)
@Import(GlobalExceptionHandler.class)
class AdminUserControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AdminUserService adminUserService;

    @MockBean
    private JwtDecoder jwtDecoder;

    @Test
    void list_returnsThePageOfUsers() throws Exception {
        when(adminUserService.listUsers(1, 50)).thenReturn(new AdminUsersPage(
                List.of(new AdminUserResponse("id-1", "alice@example.com", "Alice",
                        "2026-01-01T00:00:00Z", null, false)),
                1, 50, false));

        mockMvc.perform(get("/api/v1/admin/users").with(jwt().jwt(j -> j.subject("admin-1"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.users[0].email").value("alice@example.com"))
                .andExpect(jsonPath("$.users[0].banned").value(false))
                .andExpect(jsonPath("$.hasMore").value(false));
    }

    @Test
    void ban_returns204_andDelegates() throws Exception {
        mockMvc.perform(put("/api/v1/admin/users/{id}/ban", "id-1")
                        .with(jwt().jwt(j -> j.subject("admin-1")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"banned\":true}"))
                .andExpect(status().isNoContent());

        verify(adminUserService).setBanned("id-1", true);
    }
}
