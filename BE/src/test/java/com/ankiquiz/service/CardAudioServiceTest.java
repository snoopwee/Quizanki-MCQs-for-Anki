package com.ankiquiz.service;

import com.ankiquiz.exception.AvatarException;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

class CardAudioServiceTest {

    // Minimal magic-byte headers for each supported container/codec.
    private static final byte[] MP3_ID3 = {'I', 'D', '3', 4, 0, 0, 0, 0};
    private static final byte[] MP3_FRAME = {(byte) 0xFF, (byte) 0xFB, 0, 0};
    private static final byte[] OGG = {'O', 'g', 'g', 'S', 0, 0, 0, 0};
    private static final byte[] WAV =
            {'R', 'I', 'F', 'F', 0, 0, 0, 0, 'W', 'A', 'V', 'E', 0};
    private static final byte[] M4A =
            {0, 0, 0, 0x18, 'f', 't', 'y', 'p', 'M', '4', 'A', ' '};
    private static final byte[] WEBM = {(byte) 0x1A, (byte) 0x45, (byte) 0xDF, (byte) 0xA3, 0};

    private CardAudioService configured() {
        return new CardAudioService("https://project.supabase.co", "service-key", "card-audio");
    }

    private CardAudioService unconfigured() {
        return new CardAudioService("https://replace-me.supabase.co", "", "card-audio");
    }

    @Test
    void sniffAudioType_recognisesSupportedFormats() {
        assertEquals("audio/mpeg", CardAudioService.sniffAudioType(MP3_ID3));
        assertEquals("audio/mpeg", CardAudioService.sniffAudioType(MP3_FRAME));
        assertEquals("audio/ogg", CardAudioService.sniffAudioType(OGG));
        assertEquals("audio/wav", CardAudioService.sniffAudioType(WAV));
        assertEquals("audio/mp4", CardAudioService.sniffAudioType(M4A));
        assertEquals("audio/webm", CardAudioService.sniffAudioType(WEBM));
    }

    @Test
    void sniffAudioType_rejectsNonAudioAndTruncatedHeaders() {
        assertNull(CardAudioService.sniffAudioType("hello world".getBytes()));
        assertNull(CardAudioService.sniffAudioType(new byte[]{(byte) 0xFF})); // too short
        assertNull(CardAudioService.sniffAudioType(new byte[0]));
        assertNull(CardAudioService.sniffAudioType(null));
    }

    @Test
    void upload_whenStorageNotConfigured_is503() {
        MockMultipartFile file = new MockMultipartFile("file", "a.mp3", "audio/mpeg", MP3_ID3);
        AvatarException ex = assertThrows(AvatarException.class, () -> unconfigured().upload("user-1", file));
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, ex.getStatus());
    }

    @Test
    void upload_emptyFile_is400() {
        MockMultipartFile file = new MockMultipartFile("file", "a.mp3", "audio/mpeg", new byte[0]);
        AvatarException ex = assertThrows(AvatarException.class, () -> configured().upload("user-1", file));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
    }

    @Test
    void upload_unsupportedType_is400_evenIfClientClaimsAudio() {
        // Client lies about Content-Type; magic bytes say otherwise → rejected.
        MockMultipartFile file = new MockMultipartFile("file", "a.mp3", "audio/mpeg", "not audio".getBytes());
        AvatarException ex = assertThrows(AvatarException.class, () -> configured().upload("user-1", file));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
    }

    @Test
    void upload_tooLarge_is413() {
        byte[] big = new byte[11 * 1024 * 1024];
        big[0] = 'I';
        big[1] = 'D';
        big[2] = '3';
        MockMultipartFile file = new MockMultipartFile("file", "a.mp3", "audio/mpeg", big);
        AvatarException ex = assertThrows(AvatarException.class, () -> configured().upload("user-1", file));
        assertEquals(HttpStatus.PAYLOAD_TOO_LARGE, ex.getStatus());
    }
}
