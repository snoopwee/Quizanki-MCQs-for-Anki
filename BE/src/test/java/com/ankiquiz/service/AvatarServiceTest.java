package com.ankiquiz.service;

import com.ankiquiz.exception.AvatarException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

class AvatarServiceTest {

    private static final byte[] JPEG = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 0, 0, 0};
    private static final byte[] PNG =
            {(byte) 0x89, 'P', 'N', 'G', (byte) 0x0D, (byte) 0x0A, (byte) 0x1A, (byte) 0x0A, 0, 0};
    private static final byte[] WEBP = {'R', 'I', 'F', 'F', 0, 0, 0, 0, 'W', 'E', 'B', 'P', 0};

    // A "configured" service still validates the image before ever calling Storage,
    // so these tests exercise the guard paths without any HTTP.
    private AvatarService configured() {
        return new AvatarService("https://project.supabase.co", "service-key", "avatars");
    }

    private AvatarService unconfigured() {
        return new AvatarService("https://replace-me.supabase.co", "", "avatars");
    }

    @Test
    void sniffImageType_recognisesSupportedFormats() {
        assertEquals("image/jpeg", AvatarService.sniffImageType(JPEG));
        assertEquals("image/png", AvatarService.sniffImageType(PNG));
        assertEquals("image/webp", AvatarService.sniffImageType(WEBP));
    }

    @Test
    void sniffImageType_rejectsNonImagesAndTruncatedHeaders() {
        assertNull(AvatarService.sniffImageType("hello world".getBytes()));
        assertNull(AvatarService.sniffImageType(new byte[]{(byte) 0xFF, (byte) 0xD8})); // too short
        assertNull(AvatarService.sniffImageType(new byte[0]));
    }

    @Test
    void upload_whenStorageNotConfigured_is503() {
        MockMultipartFile file = new MockMultipartFile("file", "a.jpg", "image/jpeg", JPEG);
        AvatarException ex = assertThrows(AvatarException.class, () -> unconfigured().upload("user-1", file));
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, ex.getStatus());
    }

    @Test
    void upload_emptyFile_is400() {
        MockMultipartFile file = new MockMultipartFile("file", "a.jpg", "image/jpeg", new byte[0]);
        AvatarException ex = assertThrows(AvatarException.class, () -> configured().upload("user-1", file));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
    }

    @Test
    void upload_unsupportedType_is400_evenIfClientClaimsImage() {
        // Client lies about Content-Type; magic bytes say otherwise → rejected.
        MockMultipartFile file = new MockMultipartFile("file", "a.jpg", "image/jpeg", "not an image".getBytes());
        AvatarException ex = assertThrows(AvatarException.class, () -> configured().upload("user-1", file));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
    }

    @Test
    void upload_tooLarge_is413() {
        byte[] big = new byte[6 * 1024 * 1024];
        big[0] = (byte) 0xFF;
        big[1] = (byte) 0xD8;
        big[2] = (byte) 0xFF;
        MockMultipartFile file = new MockMultipartFile("file", "a.jpg", "image/jpeg", big);
        AvatarException ex = assertThrows(AvatarException.class, () -> configured().upload("user-1", file));
        assertEquals(HttpStatus.PAYLOAD_TOO_LARGE, ex.getStatus());
    }
}
