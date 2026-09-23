package com.ankiquiz.controller;

import com.ankiquiz.dto.response.FollowStatusResponse;
import com.ankiquiz.dto.response.FollowedAuthorResponse;
import com.ankiquiz.exception.ConflictException;
import com.ankiquiz.exception.GlobalExceptionHandler;
import com.ankiquiz.exception.NotFoundException;
import com.ankiquiz.service.FollowService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(FollowController.class)
@Import(GlobalExceptionHandler.class)
class FollowControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private FollowService followService;

    @MockBean
    private JwtDecoder jwtDecoder;

    @Test
    void reportsWhetherYouFollowAnAuthorAndHowManyDo() throws Exception {
        when(followService.status("user-1", "author-9"))
                .thenReturn(new FollowStatusResponse(true, 12, false));

        mockMvc.perform(get("/api/v1/authors/{authorId}/follow", "author-9")
                        .with(jwt().jwt(j -> j.subject("user-1"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.following").value(true))
                .andExpect(jsonPath("$.followers").value(12))
                .andExpect(jsonPath("$.self").value(false));
    }

    @Test
    void followingAndUnfollowingBothReturnTheNewState() throws Exception {
        when(followService.follow("user-1", "author-9"))
                .thenReturn(new FollowStatusResponse(true, 13, false));
        when(followService.unfollow("user-1", "author-9"))
                .thenReturn(new FollowStatusResponse(false, 12, false));

        mockMvc.perform(put("/api/v1/authors/{authorId}/follow", "author-9")
                        .with(jwt().jwt(j -> j.subject("user-1"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.following").value(true))
                .andExpect(jsonPath("$.followers").value(13));

        mockMvc.perform(delete("/api/v1/authors/{authorId}/follow", "author-9")
                        .with(jwt().jwt(j -> j.subject("user-1"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.following").value(false));
    }

    @Test
    void followingYourselfIs409() throws Exception {
        when(followService.follow(any(), any()))
                .thenThrow(new ConflictException("You can't follow yourself."));

        mockMvc.perform(put("/api/v1/authors/{authorId}/follow", "author-9")
                        .with(jwt().jwt(j -> j.subject("author-9"))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("You can't follow yourself."));
    }

    @Test
    void anAuthorWithNothingPublishedIs404() throws Exception {
        when(followService.follow(any(), any())).thenThrow(new NotFoundException("Author not found"));

        mockMvc.perform(put("/api/v1/authors/{authorId}/follow", "nobody")
                        .with(jwt().jwt(j -> j.subject("user-1"))))
                .andExpect(status().isNotFound());
    }

    @Test
    void listsWhoYouFollow() throws Exception {
        when(followService.following("user-1")).thenReturn(List.of(
                new FollowedAuthorResponse("author-9", "Mai", "https://example.test/mai.webp", 4)));

        mockMvc.perform(get("/api/v1/me/following").with(jwt().jwt(j -> j.subject("user-1"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].authorId").value("author-9"))
                .andExpect(jsonPath("$[0].authorName").value("Mai"))
                .andExpect(jsonPath("$[0].publicDecks").value(4));
    }

    @Test
    void everyFollowRouteNeedsAnAccount() throws Exception {
        mockMvc.perform(get("/api/v1/authors/{authorId}/follow", "author-9"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/me/following")).andExpect(status().isUnauthorized());
        // csrf() because a @WebMvcTest slice doesn't load SecurityConfig (which disables CSRF), so
        // these would otherwise be refused as 403 before authentication is reached.
        mockMvc.perform(put("/api/v1/authors/{authorId}/follow", "author-9").with(csrf()))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(delete("/api/v1/authors/{authorId}/follow", "author-9").with(csrf()))
                .andExpect(status().isUnauthorized());

        verify(followService, never()).follow(any(), any());
        verify(followService, never()).unfollow(any(), any());
        verify(followService, never()).following(any());
    }
}
