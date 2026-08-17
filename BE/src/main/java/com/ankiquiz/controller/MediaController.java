package com.ankiquiz.controller;

import com.ankiquiz.dto.request.MediaExistsRequest;
import com.ankiquiz.dto.response.MediaExistsResponse;
import com.ankiquiz.service.MediaObjectService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * Content-addressed media pre-check. Before uploading a batch of images/audio, the
 * client hashes each blob and asks here which ones storage already has, so it only
 * uploads the genuinely new bytes. Authenticated (under {@code /api/v1/me}).
 */
@RestController
@RequestMapping("/api/v1/me")
@SecurityRequirement(name = "bearerAuth")
public class MediaController {

    // Cap the batch so a hostile client can't ask us to IN-query an unbounded list.
    private static final int MAX_HASHES = 5000;
    private static final int HASH_LEN = 64; // SHA-256 hex

    private final MediaObjectService mediaObjects;

    public MediaController(MediaObjectService mediaObjects) {
        this.mediaObjects = mediaObjects;
    }

    @PostMapping("/media/exists")
    @Operation(summary = "Which of these content hashes are already stored",
            description = "Body: { hashes: [sha256hex, …] }. Returns { urls: { hash: publicUrl } } for the "
                    + "hashes already in storage; absent hashes should be uploaded. Lets the client skip "
                    + "re-sending media the server already has.")
    public MediaExistsResponse exists(@AuthenticationPrincipal Jwt jwt,
                                      @RequestBody MediaExistsRequest req) {
        List<String> hashes = req.hashes() == null ? List.of() : req.hashes().stream()
                .filter(h -> h != null && h.length() == HASH_LEN)
                .distinct()
                .limit(MAX_HASHES)
                .toList();
        if (hashes.isEmpty()) {
            return new MediaExistsResponse(Map.of());
        }
        return new MediaExistsResponse(mediaObjects.existing(hashes));
    }
}
