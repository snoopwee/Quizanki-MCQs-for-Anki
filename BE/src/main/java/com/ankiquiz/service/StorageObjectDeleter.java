package com.ankiquiz.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.net.URI;

/**
 * Deletes a single object from Supabase Storage with the service-role key — used by
 * the orphan-GC sweep. Separate from the card upload services (which only ever
 * write) so the one destructive Storage operation lives in one small, obvious place.
 */
@Component
public class StorageObjectDeleter {

    private static final Logger log = LoggerFactory.getLogger(StorageObjectDeleter.class);

    private final String supabaseUrl;
    private final String serviceKey;
    private final RestClient http = RestClient.create();

    public StorageObjectDeleter(
            @Value("${supabase.url:}") String supabaseUrl,
            @Value("${supabase.service-key:${tts.supabase.service-key:}}") String serviceKey) {
        this.supabaseUrl = supabaseUrl;
        this.serviceKey = serviceKey;
    }

    /**
     * Delete {@code bucket/path}. Returns true if it's gone (deleted now, or already
     * absent → 404), false on any error — so the caller keeps the registry row and
     * retries the object on the next run rather than losing track of it.
     */
    public boolean delete(String bucket, String path) {
        try {
            http.delete()
                    .uri(URI.create(supabaseUrl + "/storage/v1/object/" + bucket + "/" + path))
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + serviceKey)
                    .header("apikey", serviceKey)
                    .retrieve()
                    .toBodilessEntity();
            return true;
        } catch (RestClientResponseException e) {
            if (e.getStatusCode().value() == 404) {
                return true; // already gone — treat as success so its row is cleaned up
            }
            log.warn("Storage delete failed {} {}/{}: {}", e.getStatusCode(), bucket, path, e.getResponseBodyAsString());
            return false;
        } catch (Exception e) {
            log.warn("Storage delete error {}/{}: {}", bucket, path, e.getMessage());
            return false;
        }
    }
}
