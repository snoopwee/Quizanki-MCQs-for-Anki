package com.ankiquiz.service;

import com.ankiquiz.dto.request.ImportAudioRequest;
import com.ankiquiz.dto.response.AudioImportResponse;
import com.ankiquiz.entity.Note;
import com.ankiquiz.exception.NotFoundException;
import com.ankiquiz.repository.DeckRepository;
import com.ankiquiz.repository.NoteRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Brings an imported deck's audio pronunciations onto its cards, <b>after</b> the
 * deck is saved. The parse step recorded each note's {@code [sound:...]} filename
 * (a tiny ref, not the bytes); the client re-sends the original .apkg here so we can
 * stream just those clips out of the archive — one at a time, never buffering a
 * whole deck of audio — and store each in Supabase Storage via {@link CardAudioService}.
 *
 * <p>Notes are matched to the parsed refs by {@code ankiNoteId}, so review edits
 * (reorder / rename / delete) between parse and save don't break the mapping. Any
 * missing, oversized, or non-audio media is skipped, not failed: the deck is already
 * saved, audio is a best-effort enhancement on top.
 */
@Service
public class ApkgAudioImportService {

    private static final Logger log = LoggerFactory.getLogger(ApkgAudioImportService.class);
    // Storage uploads are network-bound, so a deck's clips upload far faster in
    // parallel (a Core-2000 deck has ~400) — bounded so we don't flood Storage or
    // hold too many clips in memory at once.
    private static final int UPLOAD_CONCURRENCY = 8;

    private final ApkgParserService parser;
    private final CardAudioService cardAudioService;
    private final DeckRepository deckRepository;
    private final NoteRepository noteRepository;

    public ApkgAudioImportService(ApkgParserService parser,
                                  CardAudioService cardAudioService,
                                  DeckRepository deckRepository,
                                  NoteRepository noteRepository) {
        this.parser = parser;
        this.cardAudioService = cardAudioService;
        this.deckRepository = deckRepository;
        this.noteRepository = noteRepository;
    }

    /**
     * Import audio for a deck the caller owns. Returns how many notes got a clip and
     * how many distinct clips were uploaded.
     * @throws NotFoundException if the deck isn't owned by the caller.
     */
    @Transactional
    public AudioImportResponse importAudio(String userId, UUID deckId, MultipartFile apkg,
                                           List<ImportAudioRequest.Ref> refs) {
        deckRepository.findByIdAndUserId(deckId, userId)
                .orElseThrow(() -> new NotFoundException("Deck not found: " + deckId));

        if (refs == null || refs.isEmpty()) {
            return new AudioImportResponse(0, 0);
        }

        // Every distinct media filename referenced by any face.
        Set<String> wanted = new HashSet<>();
        for (ImportAudioRequest.Ref r : refs) {
            addIfPresent(wanted, r.front());
            addIfPresent(wanted, r.back());
        }
        if (wanted.isEmpty()) {
            return new AudioImportResponse(0, 0);
        }

        // Stream the referenced clips out of the .apkg and upload them in parallel
        // (uploads are network-bound). A bounded pool + queue with CallerRuns gives
        // natural backpressure, so the streaming thread never gets far ahead of the
        // uploads — memory stays bounded. A clip that isn't real audio, is too big,
        // or fails to upload is simply skipped.
        Map<String, String> urlByFilename = new ConcurrentHashMap<>();
        ThreadPoolExecutor pool = new ThreadPoolExecutor(
                UPLOAD_CONCURRENCY, UPLOAD_CONCURRENCY, 0L, TimeUnit.MILLISECONDS,
                new ArrayBlockingQueue<>(UPLOAD_CONCURRENCY),
                new ThreadPoolExecutor.CallerRunsPolicy());
        try {
            parser.streamReferencedMedia(apkg, wanted, (filename, bytes) -> {
                if (urlByFilename.containsKey(filename)) {
                    return;
                }
                String contentType = CardAudioService.sniffAudioType(bytes);
                if (contentType == null) {
                    return;
                }
                pool.execute(() -> {
                    try {
                        urlByFilename.put(filename, cardAudioService.uploadBytes(userId, bytes, contentType));
                    } catch (RuntimeException e) {
                        log.warn("Skipping a card-audio clip that failed to upload: {}", e.getMessage());
                    }
                });
            });
        } finally {
            pool.shutdown();
            try {
                if (!pool.awaitTermination(5, TimeUnit.MINUTES)) {
                    pool.shutdownNow();
                }
            } catch (InterruptedException e) {
                pool.shutdownNow();
                Thread.currentThread().interrupt();
            }
        }
        if (urlByFilename.isEmpty()) {
            return new AudioImportResponse(0, 0);
        }

        // Match refs to the saved notes by Anki id and set the resolved URLs.
        Set<String> ankiIds = refs.stream()
                .map(ImportAudioRequest.Ref::ankiNoteId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<String, Note> byAnki = noteRepository.findAllByDeckIdAndAnkiNoteIdIn(deckId, ankiIds).stream()
                .collect(Collectors.toMap(Note::getAnkiNoteId, Function.identity(), (a, b) -> a));

        List<Note> toSave = new ArrayList<>();
        for (ImportAudioRequest.Ref r : refs) {
            Note note = byAnki.get(r.ankiNoteId());
            if (note == null) {
                continue;
            }
            boolean changed = false;
            String frontUrl = r.front() == null ? null : urlByFilename.get(r.front());
            String backUrl = r.back() == null ? null : urlByFilename.get(r.back());
            if (frontUrl != null) {
                note.setFrontAudioUrl(frontUrl);
                changed = true;
            }
            if (backUrl != null) {
                note.setBackAudioUrl(backUrl);
                changed = true;
            }
            if (changed) {
                toSave.add(note);
            }
        }
        noteRepository.saveAll(toSave);
        return new AudioImportResponse(toSave.size(), urlByFilename.size());
    }

    private static void addIfPresent(Set<String> set, String value) {
        if (value != null && !value.isBlank()) {
            set.add(value);
        }
    }
}
