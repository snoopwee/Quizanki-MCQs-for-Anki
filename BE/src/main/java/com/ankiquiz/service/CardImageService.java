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

/**
 * Stores flashcard images in a public Supabase Storage bucket, written server-side
 * with the service-role key. <b>Content-addressed (V18):</b> the object key is the
 * SHA-256 of the bytes (via {@link MediaObjectService}), so the same image is
 * stored <em>once</em> no matter how many users import the same deck, and a
 * re-import uploads nothing. The returned public URL is saved onto the note's
 * {@code front_image_url}/{@code back_image_url}, and served with a long, immutable
 * cache header (a content-addressed object never changes meaning).
 *
 * <p>Images are validated by magic bytes (never trusting the client Content-Type),
 * reusing {@link AvatarService#sniffImageType}.
 */
@Service
public class CardImageService {

    private static final Logger log = LoggerFactory.getLogger(CardImageService.class);
    private static final long MAX_BYTES = 5L * 1024 * 1024; // 5 MB per card image
    // A year, immutable: each object is content-addressed by hash, never
    // overwritten, so the browser can cache it indefinitely — the main lever on
    // Storage egress. Mirrors CardAudioService.
    private static final String CACHE_CONTROL = "public, max-age=31536000, immutable";

    private final String supabaseUrl;
    private final String serviceKey;
    private final String bucket;
    private final MediaObjectService mediaObjects;
    private final RestClient http = RestClient.create();
    private volatile boolean bucketReady = false;

    public CardImageService(
            @Value("${supabase.url:}") String supabaseUrl,
            @Value("${supabase.service-key:${tts.supabase.service-key:}}") String serviceKey,
            @Value("${card-image.bucket:card-images}") String bucket,
            MediaObjectService mediaObjects
    ) {
        this.supabaseUrl = supabaseUrl;
        this.serviceKey = serviceKey;
        this.bucket = bucket;
        this.mediaObjects = mediaObjects;
    }

    /**
     * Upload one card image for the user. Returns a public URL to store on the card
     * (an existing one if this exact image is already stored).
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
            throw new AvatarException(HttpStatus.BAD_REQUEST, "Please upload a PNG, JPG, WebP or GIF image.");
        }
        return storeDeduped(bytes, contentType);
    }

    /**
     * Store bytes content-addressed: if this exact image is already in storage,
     * reuse it (no upload); otherwise upload it at its hash and register it.
     */
    private String storeDeduped(byte[] bytes, String contentType) {
        String hash = MediaObjectService.sha256Hex(bytes);
        if (mediaObjects.exists(hash)) {
            return mediaObjects.publicUrl(bucket, hash);
        }
        ensureBucket();
        putObject(hash, bytes, contentType);
        mediaObjects.record(hash, bucket, contentType, bytes.length);
        return mediaObjects.publicUrl(bucket, hash);
    }

    // --- helpers (mirrors AvatarService / CardAudioService) -----------------

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

    private void putObject(String path, byte[] bytes, String contentType) {
        try {
            http.post()
                    .uri(URI.create(objectApiUrl(path)))
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + serviceKey)
                    .header("apikey", serviceKey)
                    .header("x-upsert", "true")
                    .header(HttpHeaders.CACHE_CONTROL, CACHE_CONTROL)
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
