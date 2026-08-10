package com.ankiquiz.service;

import com.ankiquiz.exception.AvatarException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.URI;
import java.util.Map;
import java.util.UUID;

/**
 * Stores flashcard images in a public Supabase Storage bucket, written server-side
 * with the service-role key — the same approach as {@link AvatarService}, but many
 * images per user instead of one. Each upload is a fresh object at
 * {@code <userId>/<uuid>}, so cards never overwrite each other; the returned public
 * URL is saved onto the note's {@code front_image_url}/{@code back_image_url}.
 *
 * <p>Images are validated by magic bytes (never trusting the client Content-Type),
 * reusing {@link AvatarService#sniffImageType}. The user id comes from the JWT, so a
 * user only ever writes under their own prefix.
 */
@Service
public class CardImageService {

    private static final Logger log = LoggerFactory.getLogger(CardImageService.class);
    private static final long MAX_BYTES = 5L * 1024 * 1024; // 5 MB per card image

    private final String supabaseUrl;
    private final String serviceKey;
    private final String bucket;
    private final RestClient http = RestClient.create();
    private volatile boolean bucketReady = false;

    public CardImageService(
            @Value("${supabase.url:}") String supabaseUrl,
            @Value("${supabase.service-key:${tts.supabase.service-key:}}") String serviceKey,
            @Value("${card-image.bucket:card-images}") String bucket
    ) {
        this.supabaseUrl = supabaseUrl;
        this.serviceKey = serviceKey;
        this.bucket = bucket;
    }

    /**
     * Upload one card image for the user. Returns a public URL to store on the card.
     * @throws AvatarException 503 if storage isn't configured, 400/413 on a bad
     *         image, 502 if Storage rejects the write.
     */
    public String upload(String userId, MultipartFile file) {
        requireConfigured();

        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw new AvatarException(HttpStatus.BAD_REQUEST, "Couldn't read the uploaded image.");
        }
        if (bytes.length == 0) {
            throw new AvatarException(HttpStatus.BAD_REQUEST, "The uploaded image is empty.");
        }
        if (bytes.length > MAX_BYTES) {
            throw new AvatarException(HttpStatus.PAYLOAD_TOO_LARGE, "That image is too large (limit 5 MB).");
        }
        String contentType = AvatarService.sniffImageType(bytes);
        if (contentType == null) {
            throw new AvatarException(HttpStatus.BAD_REQUEST, "Please upload a PNG, JPG or WebP image.");
        }

        ensureBucket();
        String path = userId + "/" + UUID.randomUUID();
        putObject(path, bytes, contentType);
        return publicUrl(path);
    }

    // --- helpers (mirrors AvatarService) ------------------------------------

    private void requireConfigured() {
        boolean urlOk = supabaseUrl != null && !supabaseUrl.isBlank() && !supabaseUrl.contains("replace-me");
        boolean keyOk = serviceKey != null && !serviceKey.isBlank();
        if (!urlOk || !keyOk) {
            throw new AvatarException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Image storage isn't configured on the server.");
        }
    }

    private String objectApiUrl(String path) {
        return supabaseUrl + "/storage/v1/object/" + bucket + "/" + path;
    }

    private String publicUrl(String path) {
        return supabaseUrl + "/storage/v1/object/public/" + bucket + "/" + path;
    }

    private void putObject(String path, byte[] bytes, String contentType) {
        try {
            http.post()
                    .uri(URI.create(objectApiUrl(path)))
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + serviceKey)
                    .header("apikey", serviceKey)
                    .header("x-upsert", "true")
                    .contentType(MediaType.valueOf(contentType))
                    .body(bytes)
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientResponseException e) {
            log.error("Card image upload failed {}: {}", e.getStatusCode(), e.getResponseBodyAsString());
            throw new AvatarException(HttpStatus.BAD_GATEWAY, "Storage rejected the upload.");
        } catch (Exception e) {
            log.error("Card image upload error", e);
            throw new AvatarException(HttpStatus.BAD_GATEWAY, "Couldn't reach storage.");
        }
    }

    private void ensureBucket() {
        if (bucketReady) {
            return;
        }
        try {
            http.post()
                    .uri(URI.create(supabaseUrl + "/storage/v1/bucket"))
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + serviceKey)
                    .header("apikey", serviceKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("id", bucket, "name", bucket, "public", true))
                    .retrieve()
                    .toBodilessEntity();
            bucketReady = true;
        } catch (RestClientResponseException e) {
            String body = e.getResponseBodyAsString();
            if (e.getStatusCode().value() == 409 || (body != null && body.toLowerCase().contains("already exists"))) {
                bucketReady = true;
            } else {
                log.warn("Card image bucket ensure failed {}: {}", e.getStatusCode(), body);
            }
        } catch (Exception e) {
            log.warn("Card image bucket ensure error; will retry on next upload", e);
        }
    }
}
