package com.ankiquiz.service;

import com.ankiquiz.dto.response.TtsResponse;
import com.ankiquiz.exception.TtsUnavailableException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Map;

/**
 * Cloud text-to-speech fallback for languages a visitor's device can't speak.
 * Synthesizes via Google Cloud Text-to-Speech and caches each clip in a public
 * Supabase Storage bucket keyed by a hash of (lang, text), so any given flashcard
 * string is synthesized once ever and served from Supabase's CDN thereafter.
 *
 * <p>Dormant by default: with no {@code tts.google.api-key} configured, every call
 * raises {@link TtsUnavailableException} (HTTP 503) and the FE quietly stays on
 * device voices. With a key but no Storage service key, audio is returned inline
 * as a {@code data:} URL (works, just uncached).
 */
@Service
public class TtsService {

    private static final Logger log = LoggerFactory.getLogger(TtsService.class);
    private static final String GOOGLE_ENDPOINT =
            "https://texttospeech.googleapis.com/v1/text:synthesize?key={key}";

    // Maps our BCP-47 primary subtags (from the FE's segmentByLang) to a Google
    // languageCode. Google needs a region; it picks a default voice for the code.
    private static final Map<String, String> LANG_TO_VOICE = Map.ofEntries(
            Map.entry("vi", "vi-VN"),
            Map.entry("ja", "ja-JP"),
            Map.entry("zh", "cmn-CN"),
            Map.entry("ko", "ko-KR"),
            Map.entry("ru", "ru-RU"),
            Map.entry("ar", "ar-XA"),
            Map.entry("es", "es-ES"),
            Map.entry("de", "de-DE"),
            Map.entry("fr", "fr-FR"),
            Map.entry("it", "it-IT"),
            Map.entry("pt", "pt-BR"),
            Map.entry("hi", "hi-IN"),
            Map.entry("th", "th-TH"),
            Map.entry("he", "he-IL"),
            Map.entry("el", "el-GR"),
            Map.entry("id", "id-ID"),
            Map.entry("nl", "nl-NL"),
            Map.entry("en", "en-US")
    );

    private final String apiKey;
    private final String supabaseUrl;
    private final String serviceKey;
    private final String bucket;
    private final RestClient http = RestClient.create();

    public TtsService(
            @Value("${tts.google.api-key:}") String apiKey,
            @Value("${supabase.url:}") String supabaseUrl,
            @Value("${tts.supabase.service-key:}") String serviceKey,
            @Value("${tts.cache.bucket:tts-cache}") String bucket
    ) {
        this.apiKey = apiKey;
        this.supabaseUrl = supabaseUrl;
        this.serviceKey = serviceKey;
        this.bucket = bucket;
    }

    public boolean isEnabled() {
        return apiKey != null && !apiKey.isBlank();
    }

    /**
     * Returns a playable audio URL for {@code text} in {@code lang}: a cached
     * public Storage URL when caching is configured, otherwise an inline data URL.
     */
    public TtsResponse synthesizeToUrl(String text, String lang) {
        if (!isEnabled()) {
            throw new TtsUnavailableException("Cloud text-to-speech is not configured.");
        }
        String languageCode = googleLanguageCode(lang);

        if (storageEnabled()) {
            String path = objectPath(lang, text);
            if (objectExists(path)) {
                return new TtsResponse(publicUrl(path));
            }
            String audioBase64 = synthesize(text, languageCode);
            byte[] audio = Base64.getDecoder().decode(audioBase64);
            if (upload(path, audio)) {
                return new TtsResponse(publicUrl(path));
            }
            // Upload failed — the public URL would 404, so serve this one inline.
            return new TtsResponse(dataUrl(audioBase64));
        }

        return new TtsResponse(dataUrl(synthesize(text, languageCode)));
    }

    /** Maps a primary subtag to a Google languageCode. Region-qualified tags
     * (e.g. {@code zh-TW}) pass through; unknown tags fall back to en-US. */
    static String googleLanguageCode(String lang) {
        if (lang == null || lang.isBlank()) {
            return "en-US";
        }
        String key = lang.toLowerCase();
        if (key.contains("-")) {
            return lang;
        }
        return LANG_TO_VOICE.getOrDefault(key, "en-US");
    }

    private boolean storageEnabled() {
        return serviceKey != null && !serviceKey.isBlank()
                && supabaseUrl != null && !supabaseUrl.isBlank()
                && !supabaseUrl.contains("replace-me");
    }

    private String objectPath(String lang, String text) {
        String safeLang = lang.toLowerCase().replaceAll("[^a-z0-9-]", "");
        return safeLang + "/" + sha256(lang + "\n" + text) + ".mp3";
    }

    private String publicUrl(String path) {
        return supabaseUrl + "/storage/v1/object/public/" + bucket + "/" + path;
    }

    private static String dataUrl(String audioBase64) {
        return "data:audio/mpeg;base64," + audioBase64;
    }

    private boolean objectExists(String path) {
        try {
            http.get()
                    .uri(URI.create(supabaseUrl + "/storage/v1/object/info/" + bucket + "/" + path))
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + serviceKey)
                    .retrieve()
                    .toBodilessEntity();
            return true;
        } catch (RestClientResponseException e) {
            if (e.getStatusCode().value() != 404) {
                log.warn("TTS cache lookup failed ({}); treating as miss", e.getStatusCode());
            }
            return false;
        } catch (Exception e) {
            log.warn("TTS cache lookup error; treating as miss", e);
            return false;
        }
    }

    /** Uploads the clip to Storage. Returns false (rather than throwing) so a
     * cache-write failure degrades to an inline data URL instead of breaking. */
    private boolean upload(String path, byte[] audio) {
        try {
            http.post()
                    .uri(URI.create(supabaseUrl + "/storage/v1/object/" + bucket + "/" + path))
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + serviceKey)
                    .header("x-upsert", "true")
                    .contentType(MediaType.valueOf("audio/mpeg"))
                    .body(audio)
                    .retrieve()
                    .toBodilessEntity();
            return true;
        } catch (Exception e) {
            log.warn("TTS cache upload failed; serving inline", e);
            return false;
        }
    }

    /** Calls Google Cloud TTS and returns the base64 MP3 (audioContent). */
    private String synthesize(String text, String languageCode) {
        try {
            Map<String, Object> body = Map.of(
                    "input", Map.of("text", text),
                    "voice", Map.of("languageCode", languageCode),
                    "audioConfig", Map.of("audioEncoding", "MP3")
            );
            GoogleSynthesizeResponse response = http.post()
                    .uri(GOOGLE_ENDPOINT, apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(GoogleSynthesizeResponse.class);
            if (response == null || response.audioContent() == null || response.audioContent().isBlank()) {
                throw new TtsUnavailableException("TTS provider returned no audio.");
            }
            return response.audioContent();
        } catch (RestClientResponseException e) {
            log.error("Google TTS error {}: {}", e.getStatusCode(), e.getResponseBodyAsString());
            throw new TtsUnavailableException("TTS provider error.", e);
        } catch (TtsUnavailableException e) {
            throw e;
        } catch (Exception e) {
            log.error("Google TTS call failed", e);
            throw new TtsUnavailableException("TTS provider unreachable.", e);
        }
    }

    private static String sha256(String value) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(md.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

    private record GoogleSynthesizeResponse(String audioContent) {
    }
}
