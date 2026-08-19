package com.ankiquiz.service;

import com.ankiquiz.entity.MediaObject;
import com.ankiquiz.repository.MediaObjectRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MediaObjectServiceTest {

    @Mock
    MediaObjectRepository repo;

    private MediaObjectService service() {
        return new MediaObjectService(repo, "https://project.supabase.co");
    }

    @Test
    void sha256Hex_matchesKnownVectors_lowercaseHex() {
        // NIST test vectors — must match the browser's crypto.subtle.digest exactly,
        // or the client's exists-check hashes would never line up with stored ones.
        assertEquals("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
                MediaObjectService.sha256Hex(new byte[0]));
        assertEquals("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
                MediaObjectService.sha256Hex("abc".getBytes(StandardCharsets.UTF_8)));
    }

    @Test
    void existing_returnsHashToPublicUrl_forStoredObjectsOnly() {
        when(repo.findAllById(List.of("hashA", "hashB", "hashC")))
                .thenReturn(List.of(obj("hashA", "card-images"), obj("hashB", "card-audio")));

        Map<String, String> urls = service().existing(List.of("hashA", "hashB", "hashC"));

        assertEquals(2, urls.size()); // hashC wasn't stored → omitted
        assertEquals("https://project.supabase.co/storage/v1/object/public/card-images/hashA", urls.get("hashA"));
        assertEquals("https://project.supabase.co/storage/v1/object/public/card-audio/hashB", urls.get("hashB"));
    }

    @Test
    void record_whenAlreadyPresent_doesNotSave() {
        when(repo.existsById("h")).thenReturn(true);
        service().record("h", "card-images", "image/webp", 123);
        verify(repo, never()).save(any());
    }

    @Test
    void record_whenNew_saves() {
        when(repo.existsById("h")).thenReturn(false);
        service().record("h", "card-images", "image/webp", 123);
        verify(repo).save(any(MediaObject.class));
    }

    @Test
    void record_swallowsRaceOnConcurrentInsert() {
        when(repo.existsById("h")).thenReturn(false);
        when(repo.save(any(MediaObject.class))).thenThrow(new DataIntegrityViolationException("dup key"));
        assertDoesNotThrow(() -> service().record("h", "card-images", "image/webp", 123));
    }

    private static MediaObject obj(String hash, String bucket) {
        MediaObject o = new MediaObject();
        o.setHash(hash);
        o.setBucket(bucket);
        o.setContentType("image/webp");
        o.setByteSize(1);
        return o;
    }
}
