package com.ankiquiz.controller;

import com.ankiquiz.dto.response.CardImageResponse;
import com.ankiquiz.service.CardImageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * Upload a flashcard image. The client posts the picked image here and gets back a
 * public URL to save onto a card face (front/back). Stored in Supabase Storage with
 * the service-role key; the user id comes from the JWT, so a user only writes under
 * their own prefix. Authenticated (under {@code /api/v1/me}).
 */
@RestController
@RequestMapping("/api/v1/me")
@SecurityRequirement(name = "bearerAuth")
public class CardImageController {

    private final CardImageService cardImageService;

    public CardImageController(CardImageService cardImageService) {
        this.cardImageService = cardImageService;
    }

    @PostMapping(value = "/card-image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Upload a flashcard image, returning its public URL",
            description = "Multipart 'file' (PNG/JPG/WebP, ≤5 MB, validated by magic bytes). Returns the "
                    + "public URL to save on a card's front_image_url/back_image_url. 503 if storage "
                    + "isn't configured on the server.")
    public CardImageResponse upload(@AuthenticationPrincipal Jwt jwt,
                                    @RequestParam("file") MultipartFile file) {
        return new CardImageResponse(cardImageService.upload(jwt.getSubject(), file));
    }
}
