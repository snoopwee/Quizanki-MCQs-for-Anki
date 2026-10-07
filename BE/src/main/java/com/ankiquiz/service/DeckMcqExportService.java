package com.ankiquiz.service;

import com.ankiquiz.entity.Deck;
import com.ankiquiz.entity.Note;
import com.ankiquiz.entity.NoteType;
import com.ankiquiz.exception.NotFoundException;
import com.ankiquiz.repository.DeckRepository;
import com.ankiquiz.repository.NoteRepository;
import com.ankiquiz.repository.NoteTypeRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Turns one of the user's decks into an Anki package of MULTIPLE-CHOICE cards.
 *
 * <p>This is the point of Phase 13. The plain {@link ApkgExportService} sends a deck back as it
 * stands; this one rewrites every card as a question with options, so the learner answers MCQs inside
 * Anki and gets Anki's own scheduler and active recall on them. The options are baked in and the card
 * template shuffles them at review time — see {@link AnkiMcqTemplate}.
 *
 * <p><b>Not every card can become one.</b> A multiple-choice question needs wrong answers, and a deck
 * supplies those from its own other cards; a note with nothing to ask, nothing to be right, or too few
 * usable alternatives is skipped. {@link ExportReport} carries the count and the reasons so the UI can
 * say what did not make it — a silent partial export is the kind of thing that quietly erodes trust.
 */
@Service
public class DeckMcqExportService {

    private static final Logger log = LoggerFactory.getLogger(DeckMcqExportService.class);

    /** Buckets the app stores card media in; the URL tells us which one a reference came from. */
    private static final String IMAGE_BUCKET = "card-images";
    private static final String AUDIO_BUCKET = "card-audio";

    private final DeckRepository deckRepository;
    private final NoteTypeRepository noteTypeRepository;
    private final NoteRepository noteRepository;
    private final ApkgWriterService writer;
    private final StorageObjectReader storage;

    public DeckMcqExportService(DeckRepository deckRepository,
                                NoteTypeRepository noteTypeRepository,
                                NoteRepository noteRepository,
                                ApkgWriterService writer,
                                StorageObjectReader storage) {
        this.deckRepository = deckRepository;
        this.noteTypeRepository = noteTypeRepository;
        this.noteRepository = noteRepository;
        this.writer = writer;
        this.storage = storage;
    }

    /**
     * What an export produced, or would produce.
     *
     * @param skippedReasons human-readable reason → how many cards it accounted for
     */
    public record ExportReport(String deckName, int totalCards, int exportedCards,
                               int skippedCards, Map<String, Integer> skippedReasons,
                               int mediaFiles, int mediaSkipped) {

        public ExportReport {
            skippedReasons = Map.copyOf(skippedReasons == null ? Map.of() : skippedReasons);
        }

        /** Nothing could be exported — the UI should say so rather than offer an empty download. */
        public boolean isEmpty() {
            return exportedCards == 0;
        }
    }

    /** A built package plus the report describing it. */
    public record ExportResult(byte[] apkg, ExportReport report) {
    }

    /**
     * What the export WOULD contain, without building it.
     *
     * <p>Exists so the UI can show "12 of 14 cards · 2 skipped" before the user commits to a
     * download. Runs the same selection as the real export, so the numbers cannot disagree with it;
     * it just stops before writing anything or touching Storage.
     */
    @Transactional(readOnly = true)
    public ExportReport preview(String userId, UUID deckId) {
        Prepared prepared = prepare(userId, deckId);
        return prepared.report(0, 0);
    }

    /** Builds the package. */
    @Transactional(readOnly = true)
    public ExportResult export(String userId, UUID deckId) {
        Prepared prepared = prepare(userId, deckId);

        ApkgWriterService.DeckSpec spec = new ApkgWriterService.DeckSpec(
                prepared.deckName + " (MCQ)",
                ApkgWriterService.NoteType.mcq("Quizanki MCQ"),
                prepared.notes,
                mediaSources(prepared.mediaRefs()));

        Path tmp = null;
        try {
            tmp = Files.createTempFile("quizanki-mcq-", ".apkg");
            ApkgWriterService.WriteResult written = writer.write(spec, tmp);
            byte[] bytes = Files.readAllBytes(tmp);
            return new ExportResult(bytes,
                    prepared.report(written.mediaWritten(), written.mediaSkipped().size()));
        } catch (IOException e) {
            throw new UncheckedIOException(new IOException("Failed to build the MCQ .apkg", e));
        } finally {
            if (tmp != null) {
                try {
                    Files.deleteIfExists(tmp);
                } catch (IOException ignored) {
                    // best-effort cleanup
                }
            }
        }
    }

    /**
     * Turns the collected media references into sources the writer can open.
     *
     * <p>Lazy on purpose: nothing is fetched until the writer reaches that entry, so a deck's
     * pictures are pulled one at a time rather than all held at once. A fetch that fails is the
     * writer's problem to survive — it drops that one file and records it, which is why an export
     * never fails over a picture that has gone missing from Storage.
     */
    private List<ApkgWriterService.Media> mediaSources(Map<String, String> refs) {
        if (refs.isEmpty() || !storage.isConfigured()) {
            if (!refs.isEmpty()) {
                log.warn("Skipping {} media files: Supabase Storage is not configured", refs.size());
            }
            return List.of();
        }
        List<ApkgWriterService.Media> media = new ArrayList<>(refs.size());
        refs.forEach((filename, url) -> {
            String bucket = bucketOf(url);
            media.add(new ApkgWriterService.Media(filename, () -> storage.open(bucket, filename)));
        });
        return media;
    }

    // ── mapping ──────────────────────────────────────────────────────────────

    /** The selection, done once and shared by preview and export so they cannot disagree. */
    private record Prepared(String deckName, int totalCards,
                            List<ApkgWriterService.Note> notes,
                            Map<McqDistractorSelector.Rejection, Integer> rejections,
                            Map<String, String> mediaRefs) {

        ExportReport report(int mediaWritten, int mediaSkipped) {
            Map<String, Integer> reasons = new LinkedHashMap<>();
            rejections.forEach((reason, count) -> reasons.put(describe(reason), count));
            int skipped = rejections.values().stream().mapToInt(Integer::intValue).sum();
            return new ExportReport(deckName, totalCards, notes.size(), skipped, reasons,
                    mediaWritten, mediaSkipped);
        }
    }

    private static String describe(McqDistractorSelector.Rejection reason) {
        return switch (reason) {
            case NO_QUESTION -> "No question text";
            case NO_ANSWER -> "No answer text";
            case TOO_FEW_DISTRACTORS -> "Not enough other cards to make options from";
        };
    }

    private Prepared prepare(String userId, UUID deckId) {
        Deck deck = deckRepository.findByIdAndUserId(deckId, userId)
                .orElseThrow(() -> new NotFoundException("Deck not found: " + deckId));
        List<NoteType> types = noteTypeRepository.findAllByDeckId(deckId);
        List<Note> notes = noteRepository.findAllByDeckIdOrderByPositionAscIdAsc(deckId);

        Map<UUID, NoteType> typeById = new LinkedHashMap<>();
        types.forEach(t -> typeById.put(t.getId(), t));

        // Answer pools. Same-type answers are semantically closer, so they are preferred; the whole
        // deck is the fallback when one type has too few cards of its own.
        Map<UUID, List<String>> answersByType = new LinkedHashMap<>();
        List<String> allAnswers = new ArrayList<>();
        for (Note note : notes) {
            String answer = answerOf(note, typeById.get(note.getNoteTypeId()));
            if (answer.isBlank()) {
                continue;
            }
            answersByType.computeIfAbsent(note.getNoteTypeId(), k -> new ArrayList<>()).add(answer);
            allAnswers.add(answer);
        }

        List<ApkgWriterService.Note> out = new ArrayList<>();
        Map<McqDistractorSelector.Rejection, Integer> rejections =
                new EnumMap<>(McqDistractorSelector.Rejection.class);
        Map<String, String> mediaRefs = new LinkedHashMap<>();

        for (Note note : notes) {
            NoteType type = typeById.get(note.getNoteTypeId());
            // A cloze note is not a multiple-choice question — its answer is a blank inside a
            // sentence, not one of several alternatives. Reported as "no answer" rather than
            // silently vanishing.
            if (type != null && type.isCloze()) {
                rejections.merge(McqDistractorSelector.Rejection.NO_ANSWER, 1, Integer::sum);
                continue;
            }

            String question = questionOf(note, type);
            String answer = answerOf(note, type);
            String guid = ApkgWriterService.stableGuid(deckId, note.getId());

            McqDistractorSelector.Result picked = McqDistractorSelector.select(
                    question, answer,
                    answersByType.getOrDefault(note.getNoteTypeId(), List.of()),
                    allAnswers, guid);

            if (!picked.usable()) {
                rejections.merge(picked.rejection(), 1, Integer::sum);
                continue;
            }

            // The template's contract: correct answer FIRST, one option per line.
            List<String> choices = new ArrayList<>();
            choices.add(answer);
            choices.addAll(picked.distractors());

            // A picture belongs on the question, where it is part of what is being asked. Options
            // stay text-only — the selector already refuses an image-only answer, which would
            // otherwise render as an empty button.
            String questionHtml = question;
            String frontImage = mediaName(note.getFrontImageUrl());
            if (frontImage != null) {
                mediaRefs.put(frontImage, note.getFrontImageUrl());
                questionHtml = "<img src=\"" + frontImage + "\"><br>" + question;
            }

            StringBuilder extra = new StringBuilder();
            String backImage = mediaName(note.getBackImageUrl());
            if (backImage != null) {
                mediaRefs.put(backImage, note.getBackImageUrl());
                extra.append("<img src=\"").append(backImage).append("\">");
            }
            for (String audioUrl : List.of(
                    note.getFrontAudioUrl() == null ? "" : note.getFrontAudioUrl(),
                    note.getBackAudioUrl() == null ? "" : note.getBackAudioUrl())) {
                String audio = mediaName(audioUrl);
                if (audio != null) {
                    mediaRefs.put(audio, audioUrl);
                    extra.append("[sound:").append(audio).append("]");
                }
            }

            out.add(new ApkgWriterService.Note(guid, List.of(
                    questionHtml,
                    String.join("\n", choices),
                    answer,
                    extra.toString(),
                    "From \"" + deck.getName() + "\" on Quizanki"),
                    List.of("quizanki")));
        }

        log.debug("MCQ export of deck {}: {} of {} cards, {} media refs",
                deckId, out.size(), notes.size(), mediaRefs.size());
        return new Prepared(deck.getName(), notes.size(), out, rejections, mediaRefs);
    }

    /** The side that is asked. Falls back to the first field when no front is configured. */
    private static String questionOf(Note note, NoteType type) {
        return faceValue(note, type, true);
    }

    /** The side that is the answer. */
    private static String answerOf(Note note, NoteType type) {
        return faceValue(note, type, false);
    }

    private static String faceValue(Note note, NoteType type, boolean front) {
        Map<String, String> fields = note.getFields() == null ? Map.of() : note.getFields();
        if (fields.isEmpty()) {
            return "";
        }
        String[] configured = type == null ? null
                : (front ? type.getFrontFields() : type.getBackFields());
        if (configured != null) {
            for (String name : configured) {
                String value = fields.get(name);
                if (value != null && !value.isBlank()) {
                    return value;
                }
            }
        }
        // No configured face: fall back to field order, which is how a Basic deck is laid out.
        String[] names = type == null ? null : type.getFieldNames();
        if (names != null && names.length > 0) {
            int index = front ? 0 : Math.min(1, names.length - 1);
            String value = fields.get(names[index]);
            return value == null ? "" : value;
        }
        return "";
    }

    /**
     * The filename a package should refer to a stored object by.
     *
     * <p>Our URLs end in a content hash ({@code .../card-images/<sha256>}), which is already unique
     * and stable — exactly what a media name needs to be. Returns null when there is no reference.
     */
    static String mediaName(String url) {
        if (url == null || url.isBlank()) {
            return null;
        }
        String path = url;
        int query = path.indexOf('?');
        if (query >= 0) {
            path = path.substring(0, query);
        }
        int slash = path.lastIndexOf('/');
        String leaf = slash >= 0 ? path.substring(slash + 1) : path;
        return leaf.isBlank() ? null : leaf;
    }

    /** Which bucket a stored URL came from. */
    static String bucketOf(String url) {
        return url != null && url.contains("/" + AUDIO_BUCKET + "/") ? AUDIO_BUCKET : IMAGE_BUCKET;
    }
}
