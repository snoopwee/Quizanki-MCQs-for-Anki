package com.ankiquiz.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;

/**
 * Reads an object back out of Supabase Storage.
 *
 * <p>The counterpart to {@link StorageObjectDeleter}, and the piece the Anki export needs: a deck's
 * pictures and audio live in Storage, and a package that references them has to carry the bytes.
 *
 * <p><b>Why the service key.</b> The buckets are not public for card media, so a plain fetch of the
 * stored URL would 404 — see {@code reference_supabase_storage_needs_jwt}: Storage REST rejects the
 * newer {@code sb_secret_} key, so this uses the legacy {@code service_role} JWT like every other
 * server-side Storage call in the app.
 *
 * <p><b>It returns bytes, not a stream from the wire.</b> One media file is capped at a few MB by the
 * app's own upload limits, and holding one at a time is simpler than keeping an HTTP connection open
 * while a zip entry is written. The writer streams them into the package one by one, so only a single
 * file is in memory at any moment.
 */
@Service
public class StorageObjectReader {

    private static final Logger log = LoggerFactory.getLogger(StorageObjectReader.class);

    private final String supabaseUrl;
    private final String serviceKey;
    private final RestClient http = RestClient.create();

    public StorageObjectReader(
            @Value("${supabase.url:}") String supabaseUrl,
            @Value("${supabase.service-key:${tts.supabase.service-key:}}") String serviceKey) {
        this.supabaseUrl = supabaseUrl == null ? "" : supabaseUrl.replaceAll("/+$", "");
        this.serviceKey = serviceKey;
    }

    /** Whether this reader is configured at all — absent credentials mean media is simply skipped. */
    public boolean isConfigured() {
        return !supabaseUrl.isBlank() && serviceKey != null && !serviceKey.isBlank();
    }

    /**
     * Fetches one object.
     *
     * @throws IOException if it cannot be read — the caller decides whether that is fatal. For an
     *                     export it is not: the card keeps its text and loses its picture.
     */
    public InputStream open(String bucket, String path) throws IOException {
        if (!isConfigured()) {
            throw new IOException("Supabase Storage is not configured");
        }
        try {
            byte[] body = http.get()
                    .uri(URI.create(supabaseUrl + "/storage/v1/object/" + bucket + "/" + path))
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + serviceKey)
                    .retrieve()
                    .body(byte[].class);
            if (body == null || body.length == 0) {
                throw new IOException("Empty object: " + bucket + "/" + path);
            }
            return new ByteArrayInputStream(body);
        } catch (IOException e) {
            throw e;
        } catch (RuntimeException e) {
            log.debug("Storage read failed for {}/{}: {}", bucket, path, e.toString());
            throw new IOException("Could not read " + bucket + "/" + path, e);
        }
    }
}
