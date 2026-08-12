package com.ankiquiz.service;

import com.ankiquiz.dto.request.ImportAudioRequest;
import com.ankiquiz.dto.response.AudioImportResponse;
import com.ankiquiz.entity.Deck;
import com.ankiquiz.entity.Note;
import com.ankiquiz.exception.NotFoundException;
import com.ankiquiz.repository.DeckRepository;
import com.ankiquiz.repository.NoteRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ApkgAudioImportServiceTest {

    private static final String USER = "user-1";

    @Mock
    private CardAudioService cardAudioService;
    @Mock
    private DeckRepository deckRepository;
    @Mock
    private NoteRepository noteRepository;

    // Real parser so the streaming (ZipFile) path is exercised end to end.
    private final ApkgParserService parser = new ApkgParserService(new ObjectMapper());
    private ApkgAudioImportService service;

    @BeforeEach
    void setUp() {
        service = new ApkgAudioImportService(parser, cardAudioService, deckRepository, noteRepository);
    }

    @Test
    void importsReferencedClip_andSetsNoteAudioUrl() throws Exception {
        UUID deckId = UUID.randomUUID();
        when(deckRepository.findByIdAndUserId(deckId, USER)).thenReturn(Optional.of(new Deck()));

        Note note = new Note();
        note.setAnkiNoteId("555");
        when(noteRepository.findAllByDeckIdAndAnkiNoteIdIn(eq(deckId), anyCollection()))
                .thenReturn(List.of(note));

        byte[] mp3 = {'I', 'D', '3', 4, 0, 0, 0, 0, 1, 2, 3};
        when(cardAudioService.uploadBytes(eq(USER), any(byte[].class), eq("audio/mpeg")))
                .thenReturn("https://cdn/hi.mp3");

        MockMultipartFile apkg = apkgWithMedia(Map.of("hi.mp3", mp3));
        List<ImportAudioRequest.Ref> refs = List.of(new ImportAudioRequest.Ref("555", "hi.mp3", null));

        AudioImportResponse result = service.importAudio(USER, deckId, apkg, refs);

        assertEquals(1, result.notesUpdated());
        assertEquals(1, result.clipsImported());
        assertEquals("https://cdn/hi.mp3", note.getFrontAudioUrl());
        assertNull(note.getBackAudioUrl());
        verify(noteRepository).saveAll(List.of(note));
    }

    @Test
    void skipsMediaThatIsNotAudio_andSavesNothing() throws Exception {
        UUID deckId = UUID.randomUUID();
        when(deckRepository.findByIdAndUserId(deckId, USER)).thenReturn(Optional.of(new Deck()));
        // A note is present, but the referenced media isn't a real audio file.
        Note note = new Note();
        note.setAnkiNoteId("555");
        lenient().when(noteRepository.findAllByDeckIdAndAnkiNoteIdIn(eq(deckId), anyCollection()))
                .thenReturn(List.of(note));

        byte[] notAudio = "this is not audio".getBytes(StandardCharsets.UTF_8);
        MockMultipartFile apkg = apkgWithMedia(Map.of("hi.mp3", notAudio));
        List<ImportAudioRequest.Ref> refs = List.of(new ImportAudioRequest.Ref("555", "hi.mp3", null));

        AudioImportResponse result = service.importAudio(USER, deckId, apkg, refs);

        assertEquals(0, result.clipsImported());
        assertEquals(0, result.notesUpdated());
        assertNull(note.getFrontAudioUrl());
        verify(cardAudioService, never()).uploadBytes(any(), any(), any());
    }

    @Test
    void throwsNotFound_whenDeckNotOwned() {
        UUID deckId = UUID.randomUUID();
        when(deckRepository.findByIdAndUserId(deckId, USER)).thenReturn(Optional.empty());

        assertThrows(NotFoundException.class, () -> service.importAudio(
                USER, deckId, apkgWithMedia(Map.of()),
                List.of(new ImportAudioRequest.Ref("555", "hi.mp3", null))));
    }

    // A minimal .apkg-shaped zip: numbered media blobs + a "media" manifest. The
    // streaming importer only reads those two, so no collection is needed.
    private static MockMultipartFile apkgWithMedia(Map<String, byte[]> media) throws IOException {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try (ZipOutputStream zos = new ZipOutputStream(baos)) {
            StringBuilder manifest = new StringBuilder("{");
            int i = 0;
            for (Map.Entry<String, byte[]> e : media.entrySet()) {
                zos.putNextEntry(new ZipEntry(String.valueOf(i)));
                zos.write(e.getValue());
                zos.closeEntry();
                if (i > 0) {
                    manifest.append(",");
                }
                manifest.append("\"").append(i).append("\":\"").append(e.getKey()).append("\"");
                i++;
            }
            manifest.append("}");
            zos.putNextEntry(new ZipEntry("media"));
            zos.write(manifest.toString().getBytes(StandardCharsets.UTF_8));
            zos.closeEntry();
        }
        return new MockMultipartFile("apkg", "deck.apkg", "application/octet-stream", baos.toByteArray());
    }
}
