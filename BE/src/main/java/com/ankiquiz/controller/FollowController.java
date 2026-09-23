package com.ankiquiz.controller;

import com.ankiquiz.dto.response.FollowStatusResponse;
import com.ankiquiz.dto.response.FollowedAuthorResponse;
import com.ankiquiz.service.FollowService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Following authors. Signed-in only — a follow has to belong to somebody — so these sit under the
 * authenticated tree even though the author pages they point at are public.
 *
 * <p>Following is one-sided by design: the author is never asked, and is never told who followed
 * or unfollowed them. What they get is an audience for the next deck they publish.
 */
@RestController
@RequestMapping("/api/v1")
@SecurityRequirement(name = "bearerAuth")
public class FollowController {

    private final FollowService followService;

    public FollowController(FollowService followService) {
        this.followService = followService;
    }

    @GetMapping("/authors/{authorId}/follow")
    @Operation(summary = "Whether you follow this author, and how many people do")
    public FollowStatusResponse status(@AuthenticationPrincipal Jwt jwt, @PathVariable String authorId) {
        return followService.status(jwt.getSubject(), authorId);
    }

    @PutMapping("/authors/{authorId}/follow")
    @Operation(summary = "Follow an author",
            description = "Idempotent. 409 on yourself; 404 for an author with nothing published, "
                    + "which is also what stops an arbitrary user id being confirmed this way.")
    public FollowStatusResponse follow(@AuthenticationPrincipal Jwt jwt, @PathVariable String authorId) {
        return followService.follow(jwt.getSubject(), authorId);
    }

    @DeleteMapping("/authors/{authorId}/follow")
    @Operation(summary = "Unfollow an author", description = "Idempotent, and tells them nothing.")
    public FollowStatusResponse unfollow(@AuthenticationPrincipal Jwt jwt, @PathVariable String authorId) {
        return followService.unfollow(jwt.getSubject(), authorId);
    }

    @GetMapping("/me/following")
    @Operation(summary = "The authors you follow", description = "Newest first, with how many public decks each has now.")
    public List<FollowedAuthorResponse> following(@AuthenticationPrincipal Jwt jwt) {
        return followService.following(jwt.getSubject());
    }
}
