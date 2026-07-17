package com.ankiquiz.controller;

import com.ankiquiz.dto.response.AvatarResponse;
import com.ankiquiz.service.AvatarService;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * Profile-picture upload/delete for the signed-in user. The client posts the
 * cropped image here; the backend stores it in Supabase Storage with the
 * service-role key (so no client-side Storage RLS is involved). The user id comes
 * from the JWT, never the request body — a user can only touch their own avatar.
 */
@RestController
@RequestMapping("/api/v1/me")
public class AvatarController {

    private final AvatarService avatarService;

    public AvatarController(AvatarService avatarService) {
        this.avatarService = avatarService;
    }

    @PostMapping(value = "/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Upload the signed-in user's profile picture",
            description = "Multipart 'file' (PNG/JPG/WebP, validated by magic bytes). Stored in "
                    + "Supabase Storage server-side; returns the cache-busted public URL to save "
                    + "into user_metadata. 503 when storage isn't configured on the server.")
    public AvatarResponse upload(@AuthenticationPrincipal Jwt jwt,
                                 @RequestParam("file") MultipartFile file) {
        return new AvatarResponse(avatarService.upload(jwt.getSubject(), file));
    }

    @DeleteMapping("/avatar")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Remove the signed-in user's stored profile picture")
    public void remove(@AuthenticationPrincipal Jwt jwt) {
        avatarService.remove(jwt.getSubject());
    }
}
