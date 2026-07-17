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
 * Stores user profile pictures in a public Supabase Storage bucket, written with
 * the project's <b>service-role key</b> so the upload bypasses Storage RLS entirely
 * — the client never touches Storage, everything goes through this authenticated
 * backend (per the project's "everything through Spring Boot" rule). Reuses the
 * same {@code SUPABASE_SERVICE_KEY} as the TTS cache; no extra secret needed.
 *
 * <p>One stable object per user ({@code <userId>/avatar}) so re-uploads overwrite
 * instead of piling up. Images are validated server-side by magic bytes (never
 * trusting the client's Content-Type) and the bucket is auto-created on first use.
 */
@Service
public class AvatarService {

    private static final Logger log = LoggerFactory.getLogger(AvatarService.class);
    private static final long MAX_BYTES = 5L * 1024 * 1024; // 5 MB (the FE sends a tiny cropped JPEG)

    private final String supabaseUrl;
    private final String serviceKey;
    private final String bucket;
    private final RestClient http = RestClient.create();
    private volatile boolean bucketReady = false;

    public AvatarService(
            @Value("${supabase.url:}") String supabaseUrl,
            // Reuse the TTS service-role key when a dedicated one isn't set.
            @Value("${supabase.service-key:${tts.supabase.service-key:}}") String serviceKey,
            @Value("${avatar.bucket:avatars}") String bucket
    ) {
        this.supabaseUrl = supabaseUrl;
        this.serviceKey = serviceKey;
        this.bucket = bucket;
    }

    /**
     * Upload (overwriting) the user's avatar. Returns a cache-busted public URL.
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
            throw new AvatarException(HttpStatus.PAYLOAD_TOO_LARGE, "That image is too large.");
        }
        String contentType = sniffImageType(bytes);
        if (contentType == null) {
            throw new AvatarException(HttpStatus.BAD_REQUEST, "Please upload a PNG, JPG or WebP image.");
        }

        ensureBucket();
        putObject(objectPath(userId), bytes, contentType);
        return publicUrl(objectPath(userId)) + "?v=" + System.currentTimeMillis();
    }

    /** Delete the user's stored avatar (idempotent — a missing object is fine). */
    public void remove(String userId) {
        requireConfigured();
        try {
            http.delete()
                    .uri(URI.create(objectApiUrl(objectPath(userId))))
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + serviceKey)
                    .header("apikey", serviceKey)
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientResponseException e) {
            int code = e.getStatusCode().value();
            if (code == 404 || code == 400) {
                return; // already gone
            }
            log.error("Avatar delete failed {}: {}", e.getStatusCode(), e.getResponseBodyAsString());
            throw new AvatarException(HttpStatus.BAD_GATEWAY, "Couldn't remove the stored image.");
        } catch (Exception e) {
            log.error("Avatar delete error", e);
            throw new AvatarException(HttpStatus.BAD_GATEWAY, "Couldn't reach storage.");
        }
    }

    // --- helpers ------------------------------------------------------------

    /** Sniff the image type from magic bytes; null if it isn't a supported image. */
    static String sniffImageType(byte[] b) {
        if (b.length >= 3 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF) {
            return "image/jpeg";
        }
        if (b.length >= 8 && (b[0] & 0xFF) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G'
                && (b[4] & 0xFF) == 0x0D && (b[5] & 0xFF) == 0x0A && (b[6] & 0xFF) == 0x1A && (b[7] & 0xFF) == 0x0A) {
            return "image/png";
        }
        if (b.length >= 12 && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F'
                && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P') {
            return "image/webp";
        }
        return null;
    }

    private void requireConfigured() {
        boolean urlOk = supabaseUrl != null && !supabaseUrl.isBlank() && !supabaseUrl.contains("replace-me");
        boolean keyOk = serviceKey != null && !serviceKey.isBlank();
        if (!urlOk || !keyOk) {
            throw new AvatarException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Profile picture storage isn't configured on the server.");
        }
    }

    private String objectPath(String userId) {
        return userId + "/avatar";
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
                    .header("apikey", serviceKey) // Supabase gateway (Kong) authenticates on this header
                    .header("x-upsert", "true")
                    .contentType(MediaType.valueOf(contentType))
                    .body(bytes)
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientResponseException e) {
            log.error("Avatar upload failed {}: {}", e.getStatusCode(), e.getResponseBodyAsString());
            throw new AvatarException(HttpStatus.BAD_GATEWAY,
                    "Storage rejected the upload (HTTP " + e.getStatusCode().value() + "): " + snippet(e));
        } catch (Exception e) {
            log.error("Avatar upload error", e);
            throw new AvatarException(HttpStatus.BAD_GATEWAY, "Couldn't reach storage: " + e.getMessage());
        }
    }

    // A short, safe excerpt of the upstream error body for the client console.
    private static String snippet(RestClientResponseException e) {
        String body = e.getResponseBodyAsString();
        if (body == null || body.isBlank()) {
            return "(no body)";
        }
        return body.length() > 200 ? body.substring(0, 200) : body;
    }

    /** Create the public bucket on first use; a pre-existing bucket is fine. */
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
                bucketReady = true; // someone (or an earlier call) already made it
            } else {
                log.warn("Avatar bucket ensure failed {}: {}", e.getStatusCode(), body);
            }
        } catch (Exception e) {
            log.warn("Avatar bucket ensure error; will retry on next upload", e);
        }
    }
}
