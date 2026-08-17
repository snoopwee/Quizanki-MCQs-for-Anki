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
 * Stores flashcard audio clips (pronunciations) in a public Supabase Storage
 * bucket, written server-side with the service-role key. <b>Content-addressed
 * (V18):</b> the object key is the SHA-256 of the bytes (via
 * {@link MediaObjectService}), so a deck's clips are stored <em>once</em> no matter
 * how many users import it, and a re-import uploads nothing. The returned public
 * URL is saved onto the note's {@code front_audio_url}/{@code back_audio_url}.
 *
 * <p>Clips are validated by magic bytes (never trusting the client Content-Type)
 * and served with a long, immutable cache header — a content-addressed object never
 * changes meaning, so the browser can replay a clip from disk cache instead of
 * re-fetching it every study session (the main lever on Storage egress for audio).
 */
@Service
public class CardAudioService {

    private static final Logger log = LoggerFactory.getLogger(CardAudioService.class);
    // Audio clips are usually small (a word is ~20–40 KB), but sentence clips and
    // the occasional WAV run larger — 10 MB is generous while still blocking a
    // pathological upload.
    private static final long MAX_BYTES = 10L * 1024 * 1024;
    // A year, immutable: content-addressed objects are never overwritten, so the
    // browser can cache them indefinitely.
    private static final String CACHE_CONTROL = "public, max-age=31536000, immutable";

    private final String supabaseUrl;
    private final String serviceKey;
    private final String bucket;
    private final MediaObjectService mediaObjects;
    private final RestClient http = RestClient.create();
    private volatile boolean bucketReady = false;

    public CardAudioService(
            @Value("${supabase.url:}") String supabaseUrl,
            @Value("${supabase.service-key:${tts.supabase.service-key:}}") String serviceKey,
            @Value("${card-audio.bucket:card-audio}") String bucket,
            MediaObjectService mediaObjects
    ) {
        this.supabaseUrl = supabaseUrl;
        this.serviceKey = serviceKey;
        this.bucket = bucket;
        this.mediaObjects = mediaObjects;
    }

    /**
     * Upload one card audio clip for the user. Returns a public URL to store on the
     * card (an existing one if this exact clip is already stored).
     * @throws AvatarException 503 if storage isn't configured, 400/413 on a bad
     *         clip, 502 if Storage rejects the write.
     */
    public String upload(String userId, MultipartFile file) {
        requireConfigured();

        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw new AvatarException(HttpStatus.BAD_REQUEST, "Couldn't read the uploaded audio.");
        }
        if (bytes.length == 0) {
            throw new AvatarException(HttpStatus.BAD_REQUEST, "The uploaded audio is empty.");
        }
        String contentType = sniffAudioType(bytes);
        if (contentType == null) {
            throw new AvatarException(HttpStatus.BAD_REQUEST, "Please upload an MP3, M4A, OGG, WAV or WebM audio file.");
        }
        return uploadBytes(userId, bytes, contentType);
    }

    /**
     * Upload already-validated audio bytes with a known content type — used by the
     * .apkg import path, which sniffs each clip as it streams it out of the archive.
     * Returns a public URL to store on the card (deduped by content hash).
     * @throws AvatarException 503 if storage isn't configured, 413 if too large,
     *         502 if Storage rejects the write.
     */
    public String uploadBytes(String userId, byte[] bytes, String contentType) {
        requireConfigured();
        if (bytes.length > MAX_BYTES) {
            throw new AvatarException(HttpStatus.PAYLOAD_TOO_LARGE, "That audio is too large (limit 10 MB).");
        }
        return storeDeduped(bytes, contentType);
    }

    /**
     * Store bytes content-addressed: if this exact clip is already in storage,
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

    /**
     * Sniff the audio type from magic bytes; null if it isn't a supported audio
     * file. Container checks come first so the loose MP3 frame-sync fallback can't
     * mis-claim them (none of the containers start with 0xFF).
     */
    static String sniffAudioType(byte[] b) {
        if (b == null) {
            return null;
        }
        // MP3 with an ID3v2 tag: "ID3".
        if (b.length >= 3 && b[0] == 'I' && b[1] == 'D' && b[2] == '3') {
            return "audio/mpeg";
        }
        // OGG (Vorbis / Opus): "OggS".
        if (b.length >= 4 && b[0] == 'O' && b[1] == 'g' && b[2] == 'g' && b[3] == 'S') {
            return "audio/ogg";
        }
        // WAV: "RIFF" .... "WAVE".
        if (b.length >= 12 && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F'
                && b[8] == 'W' && b[9] == 'A' && b[10] == 'V' && b[11] == 'E') {
            return "audio/wav";
        }
        // MP4 / M4A / AAC / 3GP container: an "ftyp" box at offset 4.
        if (b.length >= 12 && b[4] == 'f' && b[5] == 't' && b[6] == 'y' && b[7] == 'p') {
            return "audio/mp4";
        }
        // WebM / Matroska (EBML header): 0x1A 0x45 0xDF 0xA3.
        if (b.length >= 4 && (b[0] & 0xFF) == 0x1A && (b[1] & 0xFF) == 0x45
                && (b[2] & 0xFF) == 0xDF && (b[3] & 0xFF) == 0xA3) {
            return "audio/webm";
        }
        // MP3 without a tag: an MPEG audio frame sync (11 set bits: 0xFF Ex/Fx).
        if (b.length >= 2 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xE0) == 0xE0) {
            return "audio/mpeg";
        }
        return null;
    }

    // --- helpers (mirrors CardImageService) ---------------------------------

    private void requireConfigured() {
        boolean urlOk = supabaseUrl != null && !supabaseUrl.isBlank() && !supabaseUrl.contains("replace-me");
        boolean keyOk = serviceKey != null && !serviceKey.isBlank();
        if (!urlOk || !keyOk) {
            throw new AvatarException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Audio storage isn't configured on the server.");
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
            log.error("Card audio upload failed {}: {}", e.getStatusCode(), e.getResponseBodyAsString());
            throw new AvatarException(HttpStatus.BAD_GATEWAY, "Storage rejected the upload.");
        } catch (Exception e) {
            log.error("Card audio upload error", e);
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
                log.warn("Card audio bucket ensure failed {}: {}", e.getStatusCode(), body);
            }
        } catch (Exception e) {
            log.warn("Card audio bucket ensure error; will retry on next upload", e);
        }
    }
}
