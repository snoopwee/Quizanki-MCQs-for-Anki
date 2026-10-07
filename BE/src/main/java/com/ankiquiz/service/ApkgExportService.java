package com.ankiquiz.service;

import com.ankiquiz.entity.Deck;
import com.ankiquiz.entity.Note;
import com.ankiquiz.entity.NoteType;
import com.ankiquiz.exception.NotFoundException;
import com.ankiquiz.repository.DeckRepository;
import com.ankiquiz.repository.NoteRepository;
import com.ankiquiz.repository.NoteTypeRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Exports one of the user's decks as an Anki {@code .apkg}, preserving it as it stands — the same
 * note types, the same fields, the same cards.
 *
 * <p><b>This class is a mapper, not a writer.</b> It loads the deck and turns it into an
 * {@link ApkgWriterService.DeckSpec}; every byte of the package format is
 * {@link ApkgWriterService}'s job. It used to contain its own complete schema-11 implementation —
 * 481 lines of table DDL, {@code col} JSON blobs, checksums and zipping — which was duplicated when
 * the MCQ export arrived needing the same format plus media and a pluggable note type. Two writers
 * of one format drift, and the second one to be fixed is the one nobody remembers. Consolidated
 * 2026-10-07; the writer's tests (39, including a round trip through our own parser) now cover this
 * path too.
 *
 * <p>Scheduling is deliberately not exported — see {@link ApkgWriterService}.
 */
@Service
public class ApkgExportService {

    private final DeckRepository deckRepository;
    private final NoteTypeRepository noteTypeRepository;
    private final NoteRepository noteRepository;
    private final ApkgWriterService writer;

    public ApkgExportService(DeckRepository deckRepository,
                             NoteTypeRepository noteTypeRepository,
                             NoteRepository noteRepository,
                             ApkgWriterService writer) {
        this.deckRepository = deckRepository;
        this.noteTypeRepository = noteTypeRepository;
        this.noteRepository = noteRepository;
        this.writer = writer;
    }

    /** The deck as an {@code .apkg}, ready to hand to the browser. */
    @Transactional(readOnly = true)
    public byte[] export(String userId, UUID deckId) {
        Deck deck = deckRepository.findByIdAndUserId(deckId, userId)
                .orElseThrow(() -> new NotFoundException("Deck not found: " + deckId));
        List<NoteType> types = noteTypeRepository.findAllByDeckId(deckId);
        List<Note> notes = noteRepository.findAllByDeckIdOrderByPositionAscIdAsc(deckId);

        return toBytes(toSpec(deck, types, notes));
    }

    /** Maps the stored deck onto the writer's vocabulary. */
    private ApkgWriterService.DeckSpec toSpec(Deck deck, List<NoteType> types, List<Note> notes) {
        List<ApkgWriterService.NoteType> writerTypes = new ArrayList<>();
        Map<UUID, Integer> indexByType = new HashMap<>();
        for (NoteType type : types) {
            indexByType.put(type.getId(), writerTypes.size());
            writerTypes.add(toWriterType(type));
        }
        // A deck with no note types of its own still has to produce a valid package.
        if (writerTypes.isEmpty()) {
            writerTypes.add(ApkgWriterService.NoteType.basic("Basic"));
        }

        List<ApkgWriterService.Note> writerNotes = new ArrayList<>();
        for (Note note : notes) {
            Integer index = indexByType.get(note.getNoteTypeId());
            if (index == null) {
                // A note whose type did not load cannot be templated. Dropping it is what the
                // previous implementation did, and it beats writing a note Anki cannot render.
                continue;
            }
            ApkgWriterService.NoteType type = writerTypes.get(index);
            Map<String, String> fields = note.getFields() == null ? Map.of() : note.getFields();
            List<String> values = new ArrayList<>(type.fieldNames().size());
            for (String name : type.fieldNames()) {
                values.add(fields.getOrDefault(name, ""));
            }
            writerNotes.add(new ApkgWriterService.Note(
                    // Derived from the ids, so re-exporting a deck UPDATES the user's cards rather
                    // than duplicating them. The previous implementation seeded its guid from a
                    // per-run counter, which meant every export looked like a new set of notes.
                    ApkgWriterService.stableGuid(deck.getId(), note.getId()),
                    index,
                    values,
                    note.getTags() == null ? List.of() : List.of(note.getTags())));
        }

        return new ApkgWriterService.DeckSpec(deck.getName(), writerTypes, writerNotes);
    }

    private ApkgWriterService.NoteType toWriterType(NoteType type) {
        String[] names = type.getFieldNames() == null ? new String[0] : type.getFieldNames();
        List<String> fieldNames = names.length == 0 ? List.of("Front") : List.of(names);

        if (type.isCloze()) {
            return ApkgWriterService.NoteType.cloze(type.getName(), fieldNames);
        }

        // Front/back are the deck's own first two fields. The stored front/back field lists would be
        // richer, but the previous export used first/second and changing that here would alter the
        // cards of every deck somebody has already exported.
        String front = fieldNames.get(0);
        String back = fieldNames.size() > 1 ? fieldNames.get(1) : front;
        return new ApkgWriterService.NoteType(
                type.getName(),
                fieldNames,
                "{{" + front + "}}",
                "{{FrontSide}}\n\n<hr id=answer>\n\n{{" + back + "}}",
                ".card { font-family: arial; font-size: 20px; text-align: center;"
                        + " color: black; background-color: white; }",
                0);
    }

    /**
     * Runs the writer into a temp file and reads it back.
     *
     * <p>The controller's contract is {@code byte[]}, and a deck without media is small. When the
     * MCQ export brings media in, that path should stream to the response instead of materialising
     * the package — see the note on {@link ApkgWriterService#write}.
     */
    private byte[] toBytes(ApkgWriterService.DeckSpec spec) {
        Path tmp = null;
        try {
            tmp = Files.createTempFile("ankiquiz-export-", ".apkg");
            writer.write(spec, tmp);
            return Files.readAllBytes(tmp);
        } catch (IOException e) {
            throw new UncheckedIOException(new IOException("Failed to build .apkg", e));
        } finally {
            if (tmp != null) {
                try {
                    Files.deleteIfExists(tmp);
                } catch (IOException ignored) {
                    // temp file cleanup is best-effort
                }
            }
        }
    }
}
