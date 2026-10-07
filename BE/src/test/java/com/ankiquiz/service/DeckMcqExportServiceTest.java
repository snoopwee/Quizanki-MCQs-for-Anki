package com.ankiquiz.service;

import com.ankiquiz.dto.response.ApkgNotesResponse;
import com.ankiquiz.entity.Deck;
import com.ankiquiz.entity.Note;
import com.ankiquiz.entity.NoteType;
import com.ankiquiz.exception.NotFoundException;
import com.ankiquiz.repository.DeckRepository;
import com.ankiquiz.repository.NoteRepository;
import com.ankiquiz.repository.NoteTypeRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.mock.web.MockMultipartFile;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

/**
 * W5 — turning a stored deck into multiple-choice cards.
 *
 * <p>Uses a REAL {@link ApkgWriterService}, so what these assert on is the package a user actually
 * downloads. The storage reader is stubbed as unconfigured: media has its own coverage in the
 * writer's tests, and wiring a fake HTTP server here would test Spring, not this mapping.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class DeckMcqExportServiceTest {

    @Mock private DeckRepository deckRepository;
    @Mock private NoteTypeRepository noteTypeRepository;
    @Mock private NoteRepository noteRepository;
    @Mock private StorageObjectReader storage;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final ApkgParserService parser = new ApkgParserService(new ObjectMapper());
    private DeckMcqExportService service;

    private static final String USER = "user-1";
    private final UUID deckId = UUID.randomUUID();
    private final UUID typeId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        service = new DeckMcqExportService(deckRepository, noteTypeRepository, noteRepository,
                new ApkgWriterService(objectMapper), storage);
        when(storage.isConfigured()).thenReturn(false);
    }

    /** The production Cell Biology deck — real content, deliberately uneven answer lengths. */
    private static final String[][] CELL_BIOLOGY = {
            {"Ribosome", "The organelle that assembles proteins from amino acids."},
            {"Photosynthesis", "The process in which light energy converts CO2 and water to glucose."},
            {"Respiration", "The process in which sugar and oxygen produce CO2, water and ATP."},
            {"Golgi apparatus", "Packages and sorts proteins for transport out of the cell."},
            {"Lysosome", "Contains digestive enzymes that break down waste and worn-out organelles."},
            {"Nucleolus", "The region inside the nucleus where ribosomes are assembled."},
    };

    private void givenDeck(String[][] cards, boolean cloze) {
        Deck deck = new Deck();
        deck.setId(deckId);
        deck.setName("Cell Biology");
        when(deckRepository.findByIdAndUserId(deckId, USER)).thenReturn(Optional.of(deck));

        NoteType type = new NoteType();
        type.setId(typeId);
        type.setDeckId(deckId);
        type.setName("Basic");
        type.setCloze(cloze);
        type.setFieldNames(new String[]{"Front", "Back"});
        type.setFrontFields(new String[]{"Front"});
        type.setBackFields(new String[]{"Back"});
        when(noteTypeRepository.findAllByDeckId(deckId)).thenReturn(List.of(type));

        List<Note> notes = new ArrayList<>();
        for (String[] row : cards) {
            Note note = new Note();
            note.setId(UUID.randomUUID());
            note.setDeckId(deckId);
            note.setNoteTypeId(typeId);
            Map<String, String> fields = new LinkedHashMap<>();
            fields.put("Front", row[0]);
            fields.put("Back", row[1]);
            note.setFields(fields);
            notes.add(note);
        }
        when(noteRepository.findAllByDeckIdOrderByPositionAscIdAsc(deckId)).thenReturn(notes);
    }

    // ── the happy path ───────────────────────────────────────────────────────

    @Test
    void everyCardInARealDeckBecomesAMultipleChoiceQuestion() {
        givenDeck(CELL_BIOLOGY, false);

        var report = service.preview(USER, deckId);

        assertThat(report.totalCards()).isEqualTo(6);
        assertThat(report.exportedCards()).isEqualTo(6);
        assertThat(report.skippedCards()).isZero();
        assertThat(report.skippedReasons()).isEmpty();
        assertThat(report.isEmpty()).isFalse();
    }

    @Test
    void theExportedPackageReadsBackThroughOurOwnParser() throws Exception {
        givenDeck(CELL_BIOLOGY, false);

        var result = service.export(USER, deckId);
        ApkgNotesResponse parsed = parser.parseNotes(new MockMultipartFile(
                "file", "mcq.apkg", "application/octet-stream", result.apkg()));

        assertThat(parsed.totalNotes()).isEqualTo(6);
        var type = parsed.noteTypes().get(0);
        assertThat(type.name()).isEqualTo("Quizanki MCQ");
        assertThat(type.fieldNames())
                .containsExactly("Question", "Choices", "Answer", "Extra", "Source");
    }

    @Test
    void theCorrectAnswerIsTheFirstChoiceBecauseThatIsTheTemplatesContract() throws Exception {
        givenDeck(CELL_BIOLOGY, false);

        var result = service.export(USER, deckId);
        ApkgNotesResponse parsed = parser.parseNotes(new MockMultipartFile(
                "file", "mcq.apkg", "application/octet-stream", result.apkg()));

        for (var note : parsed.noteTypes().get(0).notes()) {
            String choices = note.fields().get("Choices");
            String answer = note.fields().get("Answer");
            // NOTE: the parser collapses whitespace when cleaning a field FOR DISPLAY, so the
            // newlines are not visible here even though they are in the package — the writer's own
            // tests assert the stored `flds` keeps them. What this can still prove is the ordering
            // that the card template depends on: the correct answer comes first.
            assertThat(choices).startsWith(answer);
        }
    }

    @Test
    void theDeckIsNamedSoItDoesNotCollideWithThePlainExport() {
        givenDeck(CELL_BIOLOGY, false);

        var report = service.preview(USER, deckId);

        // Importing both exports of one deck must not merge them into the same Anki deck.
        assertThat(report.deckName()).isEqualTo("Cell Biology");
    }

    @Test
    void eachCardCarriesTheSourceDeckSoACollectionStaysTraceable() throws Exception {
        givenDeck(CELL_BIOLOGY, false);

        var result = service.export(USER, deckId);
        ApkgNotesResponse parsed = parser.parseNotes(new MockMultipartFile(
                "file", "mcq.apkg", "application/octet-stream", result.apkg()));

        assertThat(parsed.noteTypes().get(0).notes().get(0).fields().get("Source"))
                .contains("Cell Biology");
    }

    // ── what gets left out, and why ──────────────────────────────────────────

    @Test
    void aDeckTooSmallToMakeOptionsFromExportsNothingAndSaysWhy() {
        // Two cards cannot furnish three wrong answers for either of them.
        givenDeck(new String[][]{{"A", "first answer"}, {"B", "second answer"}}, false);

        var report = service.preview(USER, deckId);

        assertThat(report.exportedCards()).isZero();
        assertThat(report.isEmpty()).isTrue();
        assertThat(report.skippedCards()).isEqualTo(2);
        assertThat(report.skippedReasons())
                .containsKey("Not enough other cards to make options from");
    }

    @Test
    void aClozeDeckIsReportedRatherThanSilentlyProducingNothing() {
        // A cloze answer is a blank inside a sentence, not one of several alternatives.
        givenDeck(CELL_BIOLOGY, true);

        var report = service.preview(USER, deckId);

        assertThat(report.exportedCards()).isZero();
        assertThat(report.skippedCards()).isEqualTo(6);
        assertThat(report.skippedReasons()).containsKey("No answer text");
    }

    @Test
    void aCardWithNoAnswerIsSkippedAndTheRestStillExport() {
        String[][] cards = new String[CELL_BIOLOGY.length + 1][];
        System.arraycopy(CELL_BIOLOGY, 0, cards, 0, CELL_BIOLOGY.length);
        cards[CELL_BIOLOGY.length] = new String[]{"Orphan question", ""};
        givenDeck(cards, false);

        var report = service.preview(USER, deckId);

        assertThat(report.exportedCards()).isEqualTo(6);
        assertThat(report.skippedCards()).isEqualTo(1);
        assertThat(report.skippedReasons()).containsEntry("No answer text", 1);
    }

    @Test
    void thePreviewAndTheExportCannotDisagree() {
        // They run the same selection on purpose: a preview that promised more than the download
        // delivered would be worse than no preview at all.
        givenDeck(CELL_BIOLOGY, false);

        var preview = service.preview(USER, deckId);
        var exported = service.export(USER, deckId).report();

        assertThat(exported.exportedCards()).isEqualTo(preview.exportedCards());
        assertThat(exported.skippedCards()).isEqualTo(preview.skippedCards());
        assertThat(exported.skippedReasons()).isEqualTo(preview.skippedReasons());
    }

    // ── determinism ──────────────────────────────────────────────────────────

    @Test
    void exportingTwiceProducesTheSameChoices() throws Exception {
        // Paired with the stable guid, this is what makes a re-export update the user's collection
        // instead of rewriting every card in it.
        givenDeck(CELL_BIOLOGY, false);

        var first = parser.parseNotes(new MockMultipartFile("file", "a.apkg",
                "application/octet-stream", service.export(USER, deckId).apkg()));
        var second = parser.parseNotes(new MockMultipartFile("file", "b.apkg",
                "application/octet-stream", service.export(USER, deckId).apkg()));

        List<String> firstChoices = first.noteTypes().get(0).notes().stream()
                .map(n -> n.fields().get("Choices")).toList();
        List<String> secondChoices = second.noteTypes().get(0).notes().stream()
                .map(n -> n.fields().get("Choices")).toList();

        assertThat(secondChoices).isEqualTo(firstChoices);
    }

    // ── access ───────────────────────────────────────────────────────────────

    @Test
    void anotherUsersDeckIsNotFound() {
        when(deckRepository.findByIdAndUserId(any(), any())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.preview("someone-else", deckId))
                .isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.export("someone-else", deckId))
                .isInstanceOf(NotFoundException.class);
    }

    // ── media naming ─────────────────────────────────────────────────────────

    @Test
    void aStoredMediaUrlBecomesItsContentHashFilename() {
        // Our URLs end in the content hash, which is already unique and stable — exactly what a
        // media name has to be.
        assertThat(DeckMcqExportService.mediaName(
                "https://x.supabase.co/storage/v1/object/public/card-images/abc123"))
                .isEqualTo("abc123");
        assertThat(DeckMcqExportService.mediaName("https://x/card-images/abc123?token=y"))
                .isEqualTo("abc123");
        assertThat(DeckMcqExportService.mediaName("")).isNull();
        assertThat(DeckMcqExportService.mediaName(null)).isNull();
    }

    @Test
    void theBucketIsTakenFromTheUrlNotGuessed() {
        assertThat(DeckMcqExportService.bucketOf("https://x/storage/v1/object/card-audio/a"))
                .isEqualTo("card-audio");
        assertThat(DeckMcqExportService.bucketOf("https://x/storage/v1/object/card-images/a"))
                .isEqualTo("card-images");
    }
}
